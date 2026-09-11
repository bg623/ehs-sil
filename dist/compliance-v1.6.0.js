/* Source: js/compliance-guidance.js */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceGuidance=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION="1.6.0";
  const profileGroups={
    environmentalActivities:["排放工业废水","排放生活污水","废水直接排放","废水间接排放","排放工业废气","排放有毒有害大气污染物","危废贮存设施","危废贮存点","排放VOCs","排放颗粒物","燃烧设施","产生一般工业固体废物","危险废物转移","一般工业固废贮存场或填埋场","一般工业固废充填回填","地下水取水","涉及突发环境事件风险"],
    regulatoryAttributes:["建设项目新改扩建","重点排污单位","土壤污染重点监管单位","排污许可重点管理","排污许可简化管理","排污登记管理","纳入环境信息依法披露企业名单","消防安全重点单位","人员密集场所"],
    workplaceActivities:["产生可燃性粉尘","涉及有限空间","涉及特种作业人员","建筑施工活动","设备检修作业","药品生产活动","医用X射线诊断活动","爆破作业","固定式钢梯或平台","仅职业性放射性因素"]
  };
  function mergeCatalog(baseRecords,baseRules,packs){
    const records=new Map(baseRecords.map(r=>[r.id,{...r}])),rules=new Map(baseRules.map(r=>[r.regulationId,{...r}]));
    const supplied=new Set();
    for(const pack of packs){
      if(pack.schemaVersion!==VERSION||!Array.isArray(pack.records))throw Error("法规增强库版本不兼容");
      for(const incoming of pack.records){
        if(supplied.has(incoming.id))throw Error(`增强库法规编号重复：${incoming.id}`);
        supplied.add(incoming.id);
        const {rule,...r}=incoming;
        records.set(r.id,{...records.get(r.id),...r,guidanceVersion:VERSION,reviewer:r.reviewer||"官方公开文本核对；适用解释由规则生成"});
        if(rule)rules.set(r.id,{...rules.get(r.id),...rule,ruleId:`V16-${r.id}`,regulationId:r.id,version:VERSION,status:r.complianceEnabled===false?"disabled":"active"});
      }
    }
    // A replacement becomes exclusive only when the successor has taken effect.
    for(const r of records.values())if(r.replaces&&r.effectiveDate)for(const old of records.values()){
      if(old.id!==r.id&&r.replaces.some(x=>[old.id,old.name,old.documentNo].includes(x)))old.supersededBy={id:r.id,effectiveDate:r.effectiveDate,name:r.name};
    }
    return {records:[...records.values()],rules:[...rules.values()]};
  }
  function clarify(results,profile){
    const groups=new Map();
    for(const r of results)for(const fact of r.missingFacts||[]){
      if(profile.answers&&profile.answers[fact]==="no")continue;
      const entry=groups.get(fact)||{fact,regulations:[]};
      entry.regulations.push(r.name);groups.set(fact,entry);
    }
    return [...groups.values()].sort((a,b)=>b.regulations.length-a.regulations.length||a.fact.localeCompare(b.fact,"zh-CN"));
  }
  function coverage(results,profile){
    const dimensions=[
      ["安全与应急",r=>/安全|事故|应急|作业|防护/.test(r.category||r.name)],
      ["职业健康",r=>/职业|健康|GBZ/.test(r.category+r.name+r.documentNo)],
      ["环境保护",r=>/环境|污染|废|排污|水|噪声|土壤/.test(r.category||r.name)],
      ["消防与设备",r=>/消防|防火|特种设备|锅炉|压力/.test(r.category+r.name)]
    ];
    return dimensions.map(([name,predicate])=>({name,matched:results.filter(predicate).length,detailed:results.filter(r=>predicate(r)&&(r.matchedClauses||[]).length).length})).concat([{name:`${profile.province||"所在地"}地方要求`,matched:results.filter(r=>r.applicabilityType==="地方要求").length,warning:"地方排放限值、园区要求及许可证专属条件尚非全覆盖；未命中不等于没有要求。"}]);
  }
  function evidenceProgress(record,checks){
    const clauses=record.matchedClauses||[],items=clauses.map(c=>checks&&checks[c.id]||{});
    const documented=items.filter(x=>x.state==="provided"&&String(x.note||"").trim()).length;
    const missing=items.filter(x=>x.state==="missing").length;
    return {total:clauses.length,documented,missing,label:missing?`已记录 ${missing} 项证据缺项`:documented===clauses.length&&clauses.length?"所列证据已登记（非合规结论）":`已登记 ${documented}/${clauses.length} 项证据`};
  }
  return {VERSION,profileGroups,mergeCatalog,clarify,coverage,evidenceProgress};
});

;
/* Source: js/compliance-engine.js */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceEngine=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const applicabilityRank={"明确适用":0,"条件适用":1,"建议复核":2,"不纳入":3};
  const statusRank={"即将实施":0,"现行有效":1,"已发布待实施":2,"部分失效":3,"待核实":4,"已废止":5};
  function cnToday(now){const parts=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now||new Date());const get=t=>parts.find(p=>p.type===t).value;return `${get("year")}-${get("month")}-${get("day")}`;}
  function daysBetween(from,to){if(!from||!to)return null;const a=Date.parse(from+"T00:00:00+08:00"),b=Date.parse(to+"T00:00:00+08:00");return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;}
  function implementationStatus(reg,today){if(reg.status==="已废止"||reg.expiryDate&&daysBetween(today,reg.expiryDate)<0||reg.supersededBy&&reg.supersededBy.effectiveDate<=today)return "已废止";if(reg.verificationStatus&&reg.verificationStatus!=="已核验")return "待核实";if(!reg.effectiveDate)return reg.status||"待核实";const d=daysBetween(today,reg.effectiveDate);if(d>90)return "已发布待实施";if(d>0)return "即将实施";return reg.status==="部分失效"?"部分失效":"现行有效";}
  function reviewReminder(date,today){if(!date)return "未设置";const d=daysBetween(today||cnToday(),date);if(d<0)return "已逾期";if(d<=30)return "30日内到期";if(d<=90)return "即将评审";return "正常";}
  function implementationDistanceLabel(date,today){const d=daysBetween(today||cnToday(),date);if(d===null)return "日期待核实";return d>0?`距实施 ${d} 天`:d===0?"今日实施":`已实施 ${Math.abs(d)} 天`;}
  function intersects(a,b){return (a||[]).some(v=>(b||[]).includes(v));}
  function profileFacts(profile){
    const facts=new Set(["生产经营单位",...["enterpriseTypes","industries","riskTags","specialOperationTypes","hazardousActivities","hazardousWasteActivities","specialEquipmentTypes","industryAttributes","managementCommitments","environmentalActivities","regulatoryAttributes","workplaceActivities"].flatMap(k=>Array.isArray(profile[k])?profile[k]:[]),...Object.entries(profile.answers||{}).filter(([,v])=>v==="yes").map(([k])=>k)]);
    const imply=(from,to)=>{if(from.some(x=>facts.has(x)))for(const x of to)facts.add(x);};
    imply(["危险化学品生产企业"],["危化品生产"]);imply(["危险化学品使用企业"],["危化品使用"]);imply(["危险化学品经营企业"],["危化品经营"]);imply(["危险化学品储存企业"],["危化品储存"]);
    if(facts.has("危化品经营")&&facts.has("危化品储存"))facts.add("危化品经营（带储存）");
    imply(["接触职业病危害"],["存在职业病危害"]);
    imply(["排放工业废水","排放生活污水","废水直接排放","废水间接排放"],["产生废水"]);
    imply(["排放VOCs","排放颗粒物","燃烧设施"],["产生废气"]);
    imply(["排放工业废气","排放有毒有害大气污染物"],["产生废气"]);
    if(facts.has("产生废气")&&(profile.industries||[]).some(x=>/制造|金属制品|石油化工/.test(x)))facts.add("排放工业废气");
    imply(["危废产生","危废暂存","危废自行利用","危废处置","危废填埋","产生一般工业固体废物"],["产生一般固体废物或危险废物"]);
    imply(["涉及有限空间"],["涉及受限空间作业"]);
    imply(["涉及受限空间作业"],["涉及有限空间"]);
    imply(["涉及动火作业","涉及受限空间作业","涉及高处作业","涉及吊装作业","涉及临时用电","涉及盲板抽堵","涉及断路或动土作业"],["涉及特殊作业"]);
    imply(["机械制造企业","电子制造企业","食品加工企业","其他工贸企业","通用设备制造","专用设备制造","金属制品","电子设备制造","食品制造"],["工贸企业"]);
    imply(["消防安全重点单位"],["涉及消防重点部位"]);
    if((profile.specialEquipmentTypes||[]).length)facts.add("使用特种设备");
    return facts;
  }
  const permitModes=["排污许可重点管理","排污许可简化管理","排污登记管理"];
  function factState(fact,profile,facts){if(facts.has(fact))return "yes";if(profile.answers&&profile.answers[fact]==="no")return "no";if(permitModes.includes(fact)&&permitModes.some(x=>x!==fact&&facts.has(x)))return "no";return "unknown";}
  function matchByRule(reg,profile,today,rule){
    if(!reg.complianceEnabled||rule.status==="disabled"||implementationStatus(reg,today)==="已废止")return {applicability:"不纳入",reasons:[]};
    const reasons=[],facts=profileFacts(profile);let applicability="不纳入";
    const regionMatch=(reg.regions||[]).includes("全国")||(reg.regions||[]).includes(profile.province)||(reg.regions||[]).includes(profile.city);
    if(reg.applicabilityType==="地方要求"&&!regionMatch)return {applicability:"不纳入",reasons:[]};
    if((rule.excludeAny||[]).some(x=>facts.has(x)))return {applicability:"不纳入",reasons:["企业画像命中排除条件"]};
    const allList=rule.includeAll||[],anyList=rule.includeAny||[],hasTrigger=allList.length>0||anyList.length>0,allHit=allList.every(x=>facts.has(x)),anyHit=!anyList.length||anyList.some(x=>facts.has(x)),directHit=hasTrigger&&allHit&&anyHit,reviewHit=(rule.reviewWhen||[]).some(x=>facts.has(x));
    const rejected=allList.some(x=>factState(x,profile,facts)==="no")||anyList.length&&anyList.every(x=>factState(x,profile,facts)==="no");
    if(rejected)return {applicability:"不纳入",reasons:["企业已确认不具备本项适用条件"]};
    if(directHit){applicability=rule.applicability==="mandatory"?"明确适用":"条件适用";const hits=[...(rule.includeAll||[]),...anyList.filter(x=>facts.has(x))];reasons.push(`${rule.explanationTemplate}${hits.length?`；画像依据：${hits.join("、")}`:""}`);if(reg.scopeSummary)reasons.push(`适用范围：${reg.scopeSummary}`);}
    else if(reviewHit){applicability="建议复核";reasons.push(`信息不足，需进一步确认：${(rule.reviewWhen||[]).filter(x=>facts.has(x)).join("、")}`);}
    if(applicability!=="不纳入"&&reg.applicabilityType==="地方要求")reasons.unshift(`企业所在地为${profile.city||profile.province}`);
    const scopeApplicability=directHit?(rule.applicability==="mandatory"?"画像范围匹配":"画像条件匹配"):applicability==="建议复核"?"范围信息待补充":"不纳入";
    if(applicability!=="不纳入"&&reg.verificationStatus!=="已核验"){applicability="建议复核";reasons.push("来源版本尚待核验；画像条件匹配不等于正式适用结论");}
    const missingFacts=reviewHit&&!directHit?[...allList.filter(x=>!facts.has(x)),...(!anyHit?anyList:[])].filter(x=>factState(x,profile,facts)==="unknown"):[];
    return {applicability,scopeApplicability,reasons,missingFacts:[...new Set(missingFacts)]};
  }
  function matchOne(reg,profile,today,rule){if(rule)return matchByRule(reg,profile,today,rule);const fallback={includeAll:reg.applicabilityType==="通用基础"?["生产经营单位"]:[],includeAny:[...(reg.enterpriseTypes||[]),...(reg.industries||[]),...(reg.riskTags||[]),...(reg.activityTags||[])],excludeAny:[],reviewWhen:reg.reviewWhenInsufficient?["使用或储存危险化学品"]:[],applicability:reg.scaleConditions&&reg.scaleConditions.length?"conditional":"mandatory",explanationTemplate:"企业画像命中现有标签"};return matchByRule(reg,profile,today,fallback);}
  function guidance(reg,match,profile){
    const facts=profileFacts(profile),matchedClauses=[],pendingClauses=[],missingFacts=[...(match.missingFacts||[])];
    for(const c of reg.clauses||[]){
      const all=c.whenAll||[],any=c.whenAny||[],yes=all.every(x=>facts.has(x))&&(!any.length||any.some(x=>facts.has(x)));
      const no=all.some(x=>factState(x,profile,facts)==="no")||any.length&&any.every(x=>factState(x,profile,facts)==="no");
      if(yes)matchedClauses.push(c);else if(!no){pendingClauses.push(c);missingFacts.push(...all.filter(x=>factState(x,profile,facts)==="unknown"),...(!any.some(x=>facts.has(x))?any.filter(x=>factState(x,profile,facts)==="unknown"):[]));}
    }
    const detailed=matchedClauses.length>0,verified=reg.verificationStatus==="已核验";
    return {matchedClauses,pendingClauses,missingFacts:[...new Set(missingFacts)],sourceVerification:verified?`${(reg.clauses||[]).length?"官方文本/条款已核对":"官方元数据已核对"}（${reg.lastVerifiedAt||"日期未记录"}）`:"版本/来源尚待核验",applicableClauses:detailed?matchedClauses.map(c=>c.reference).join("；"):reg.applicableClauses||"尚无已核对的条款卡",requirementSummary:detailed?matchedClauses.map(c=>`${c.reference}：${c.summary}`).join("\n"):reg.requirementSummary||"此记录尚未完成条款结构化，不生成具体义务。",evidenceRequirement:[...new Set(matchedClauses.flatMap(c=>c.evidence||[]))].join("；"),suggestedAction:matchedClauses.map(c=>c.action).filter(Boolean).join("；"),evaluationDraft:detailed?`${match.applicability==="建议复核"?"范围尚缺信息；以下为预备检查项":"已根据画像生成检查项"}。${pendingClauses.length?`另有 ${pendingClauses.length} 组条件条款可通过补充画像判断。`:""}履行情况需以实际证据为准，不自动判定符合。`:"暂未形成条款级检查清单；不会以空白摘要冒充已完成评价。"};
  }
  function identify(regulations,profile,options){const today=(options&&options.today)||cnToday(),ruleMap=new Map(((options&&options.rules)||[]).map(r=>[r.regulationId,r]));return regulations.map(r=>{const m=matchOne(r,profile,today,ruleMap.get(r.id));return {...r,...m,...guidance(r,m,profile),computedStatus:implementationStatus(r,today)};}).filter(r=>(options&&options.includeExcluded)||r.applicability!=="不纳入").sort((a,b)=>(applicabilityRank[a.applicability]-applicabilityRank[b.applicability])||((b.matchedClauses.length>0)-(a.matchedClauses.length>0))||(a.levelRank-b.levelRank)||(statusRank[a.computedStatus]-statusRank[b.computedStatus])||a.name.localeCompare(b.name,"zh-CN"));}
  return {cnToday,daysBetween,implementationStatus,implementationDistanceLabel,reviewReminder,profileFacts,factState,matchOne,identify};
});

;
/* Source: js/compliance-workflow.js */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceWorkflow=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const PROJECT_SCHEMA="1.0.0";
  function requiredMissing(e){const missing=["基本符合","不符合"].includes(e.judgment)?[["gap","差距分析"],["action","整改措施"],["owner","责任人"],["due","计划完成日期"]].filter(([key])=>!String(e[key]||"").trim()).map(([,label])=>label):[];if(e.judgment==="符合"&&!String(e.evidence||"").trim())missing.push("符合判定的客观证据");if(e.judgment==="不适用"&&!String(e.evidence||"").trim())missing.push("不适用的范围依据");return missing;}
  function evaluationStatus(e,today,daysBetween){if(e.judgment==="待评价"||!e.judgment)return "未开始";if(["符合","不适用"].includes(e.judgment))return "已关闭";if(e.completedAt&&e.verification)return "已关闭";if(e.completedAt)return "待验证";const days=e.due?daysBetween(today,e.due):null;if(days!==null&&days<0)return `已逾期 ${Math.abs(days)} 天`;return "整改中";}
  function createProject({profile,selected,evaluations,addedUpdates,updatedAt}){return {schemaVersion:PROJECT_SCHEMA,tool:"EHS-SIL Compliance Identification",profile,selectedRegulationIds:Object.entries(selected).filter(([,value])=>value).map(([id])=>id),evaluations,addedUpdates:addedUpdates||[],dynamicRecords:{},updatedAt:updatedAt||new Date().toISOString()};}
  function validateProject(project){if(!project||typeof project!=="object")throw Error("项目文件不是有效对象");if(project.schemaVersion!==PROJECT_SCHEMA)throw Error(`不支持的项目版本：${project.schemaVersion||"缺失"}`);if(!project.profile||typeof project.profile!=="object")throw Error("项目文件缺少企业画像");if(!Array.isArray(project.selectedRegulationIds))throw Error("项目文件缺少已选法规");if(!project.evaluations||typeof project.evaluations!=="object"||Array.isArray(project.evaluations))throw Error("项目文件缺少评价记录");if(project.addedUpdates!==undefined&&!Array.isArray(project.addedUpdates))throw Error("项目文件的动态法规记录格式无效");return project;}
  const legacyValidateProject=validateProject;
  function validateSafeProject(project){
    legacyValidateProject(project);
    const walk=(value,depth=0)=>{if(depth>12)throw Error("项目嵌套过深");if(value&&typeof value==="object")for(const [key,v] of Object.entries(value)){if(["__proto__","constructor","prototype"].includes(key))throw Error("项目含不安全字段");walk(v,depth+1);}};
    walk(project);
    const p=project.profile;
    if(Array.isArray(p))throw Error("企业画像应为对象");
    for(const field of ["enterpriseTypes","industries","riskTags","specialOperationTypes","hazardousActivities","hazardousWasteActivities","specialEquipmentTypes","industryAttributes","managementCommitments","environmentalActivities","regulatoryAttributes","workplaceActivities"])if(p[field]!==undefined&&(!Array.isArray(p[field])||p[field].length>200||p[field].some(v=>typeof v!=="string"||v.length>160)))throw Error(`画像字段无效：${field}`);
    if(p.answers!==undefined&&(!p.answers||typeof p.answers!=="object"||Array.isArray(p.answers)||Object.values(p.answers).some(v=>!["yes","no","unknown"].includes(v))))throw Error("画像追问回答无效");
    if(project.selectedRegulationIds.length>1000||project.selectedRegulationIds.some(v=>typeof v!=="string"||!/^[-A-Za-z0-9_]+$/.test(v)))throw Error("法规编号无效");
    for(const e of Object.values(project.evaluations)){if(!e||typeof e!=="object"||Array.isArray(e))throw Error("评价记录格式无效");if(e.judgment!==undefined&&!["待评价","符合","基本符合","不符合","不适用"].includes(e.judgment))throw Error("评价判定无效");}
    return project;
  }
  return {PROJECT_SCHEMA,requiredMissing,evaluationStatus,createProject,validateProject:validateSafeProject};
});

;
/* Source: js/compliance-export.js */
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

;
/* Source: js/compliance-analytics.js */
/** Privacy-limited analytics for the compliance identification tool. */
(function(){"use strict";
const CATEGORY="compliance_identification",allowed=new Set(["example_used","result_generated","export_clicked","excel_exported","detail_opened","vip_prompt_viewed","vip_entry_clicked","knowledge_planet_clicked","profile_refined","evidence_recorded"]);
function track(eventName,mode){if(!allowed.has(eventName))return false;const safeMode=mode==="example"?"example":"user";window._hmt=window._hmt||[];window._hmt.push(["_trackEvent",CATEGORY,eventName,safeMode]);window.dispatchEvent(new CustomEvent("ehs-sil:compliance-analytics",{detail:{event:eventName,mode:safeMode}}));return true;}
window.EhsComplianceAnalytics={track,allowedEvents:[...allowed]};
})();

;
/* Source: js/compliance-app.js */
(function(){"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],Engine=window.EHSComplianceEngine,Guidance=window.EHSComplianceGuidance,Workflow=window.EHSComplianceWorkflow,Exporter=window.EHSComplianceExport,Analytics=window.EhsComplianceAnalytics,KEY="ehs-sil-compliance-v1.2",EXPORT_CAPABILITY="compliance_excel_export",FREE_PREVIEW_LIMIT=6;let step=0,regulations=[],rules=[],changes=[],results=[],databaseMeta={},usageMode="user",memberHasFullAccess=false,dataReady=false,state={profile:{},evaluations:{},selected:{},addedUpdates:[],updatedAt:""};
const specialOperationTags=["涉及动火作业","涉及受限空间作业","涉及高处作业","涉及吊装作业","涉及临时用电","涉及盲板抽堵","涉及断路或动土作业"];
const options={enterpriseTypes:["危险化学品生产企业","危险化学品经营企业","危险化学品使用企业","危险化学品储存企业","一般化工企业","制药企业","机械制造企业","电子制造企业","食品加工企业","仓储物流企业","其他工贸企业"],industries:["化学原料和化学制品制造","石油化工","医药制造","通用设备制造","专用设备制造","金属制品","电子设备制造","食品制造","仓储物流","其他"],riskTags:["构成危险化学品重大危险源","涉及易燃易爆场所","涉及重点监管危险化学品","涉及重点监管危险化工工艺","涉及特殊作业","存在职业病危害","产生废水","产生废气","产生工业噪声","产生一般固体废物或危险废物","设置环保治理设施","涉及消防重点部位","使用承包商","其他高风险活动"],specialOperationTypes:specialOperationTags,hazardousActivities:["危化品生产","危化品经营","危化品使用","危化品储存","危化品进口"],hazardousWasteActivities:["危废产生","危废暂存","危废自行利用","危废处置","危废填埋"],specialEquipmentTypes:["锅炉","压力容器","压力管道","气瓶","电梯","起重机械","场（厂）内专用机动车辆"],industryAttributes:["化工属性","石油化工属性"],managementCommitments:["自愿采纳ISO 45001","自愿采纳ISO 14001","自愿采纳其他标准"]};
function escape(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
Object.assign(options,Guidance.profileGroups);
function renderChoices(){for(const [id,vals] of Object.entries(options))$("#"+id).innerHTML=vals.map(v=>`<label class="choice"><input type="checkbox" name="${id}" value="${escape(v)}"><span>${escape(v)}</span></label>`).join("");}
function profile(){const form=new FormData($("#profileForm")),p={companyName:form.get("companyName")||"",province:form.get("province")||"",city:form.get("city")||"",scale:form.get("scale")||"",ownership:form.get("ownership")||"",answers:{...(state.profile.answers||{})},legacyEnvironmentUnknown:state.profile.legacyEnvironmentUnknown||false};for(const id of Object.keys(options))p[id]=form.getAll(id);return p;}
function setStep(n){step=n;$$('.form-step').forEach((el,i)=>el.classList.toggle('active',i===n));$$('.step-dot').forEach((el,i)=>el.classList.toggle('active',i<=n));$('#prevBtn').disabled=n===0;$('#nextBtn').classList.toggle('hidden',n===2);$('#identifyBtn').classList.toggle('hidden',n!==2);}
function validateStep(){if(step===0&&!$('#profileForm').reportValidity())return false;if(step===1&&!$$('[name=enterpriseTypes]:checked').length){show('请至少选择一个企业类型。','error');return false;}return true;}
function show(msg,type='ok'){const el=$('#feedback');el.textContent=msg;el.className=`feedback show ${type}`;setTimeout(()=>el.classList.remove('show'),7000);}
function save(){state.profile=profile();state.updatedAt=new Date().toISOString();if(usageMode==='example')return;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{show('浏览器存储不可用，修改暂存在本页；离开前请导出项目。','error');}}
function migrateProfile(p){const riskTags=p.riskTags||[],legacyOperations=riskTags.filter(x=>specialOperationTags.includes(x)),legacyEnvironment=riskTags.includes("产生废水、废气或噪声");p.riskTags=riskTags.filter(x=>!specialOperationTags.includes(x)&&x!=="产生废水、废气或噪声");if(legacyOperations.length){p.riskTags.push("涉及特殊作业");p.specialOperationTypes=[...new Set([...(p.specialOperationTypes||[]),...legacyOperations])];}if(legacyEnvironment)p.legacyEnvironmentUnknown=true;p.riskTags=[...new Set(p.riskTags)];return p;}
function restore(){try{const saved=JSON.parse(localStorage.getItem(KEY));if(!saved)return;state={profile:{},evaluations:{},selected:{},addedUpdates:[],updatedAt:'',...saved};state.profile=migrateProfile(state.profile);for(const no of state.addedUpdates||[]){const c=changes.find(x=>x.documentNo===no);if(c&&!regulations.some(r=>r.documentNo===no))regulations.push(updateRecord(c));}for(const [k,v] of Object.entries(state.profile)){if(Array.isArray(v))v.forEach(x=>{const el=$(`[name="${k}"][value="${CSS.escape(x)}"]`);if(el)el.checked=true;});else{const el=$(`[name="${k}"]`);if(el)el.value=v;}}if(state.profile.companyName&&state.profile.province){run();show('已恢复本地保存的数据。');}}catch(e){console.warn('Local data restore failed',e);}}
function run(scroll=true){if(!dataReady){show('法规数据尚未完整加载，请稍后重试。','error');return;}const p=profile();if(!p.companyName||!p.province){setStep(0);$('#profileForm').reportValidity();return;}const facts=Engine.profileFacts(p),permit=['排污许可重点管理','排污许可简化管理','排污登记管理'].filter(x=>facts.has(x));if(permit.length>1){$('#profileError').textContent='请按单一排污单位建立画像，排污管理类别只能选一项。';setStep(2);return;}$('#profileError').textContent='';results=Engine.identify(regulations,p,{rules});results.forEach(r=>{if(state.selected[r.id]===undefined)state.selected[r.id]=true;const e=state.evaluations[r.id],signature=[r.name,r.documentNo,r.guidanceVersion||'1.5'].join('|');if(e){if(e.judgment&&e.judgment!=='待评价'&&e.recordVersion!==signature)e.needsReassessment=true;e.recordVersion=signature;}});save();$('#initialState').classList.add('hidden');$('#resultArea').classList.remove('hidden');renderAll();if(Analytics)Analytics.track('result_generated',usageMode);if(scroll)window.scrollTo({top:document.querySelector('.results').offsetTop-12,behavior:'smooth'});}
function badge(v){const m={"明确适用":"clear","条件适用":"condition","建议复核":"review","现行有效":"current","即将实施":"upcoming","已发布待实施":"upcoming","已废止":"expired","待核实":"pending"};return `<span class="badge badge-${m[v]||'pending'}">${escape(v)}</span>`;}
function renderStats(){const count=v=>results.filter(r=>r.applicability===v).length,selected=results.filter(r=>state.selected[r.id]),evaluated=selected.filter(r=>evalFor(r.id).judgment!=='待评价').length,coverage=selected.length?Math.round(evaluated/selected.length*100):0,overdue=selected.filter(r=>evaluationStatus(evalFor(r.id)).startsWith('已逾期')).length,local=results.filter(r=>r.applicabilityType==='地方要求').length;$('#stats').innerHTML=[[count('明确适用'),'正式匹配'],[count('建议复核'),'建议复核'],[`${coverage}%`,'评价覆盖率'],[overdue,'逾期整改'],[results.filter(r=>r.computedStatus==='即将实施').length,'即将实施'],[local,'地方要求']].map(x=>`<div class="stat"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');}
function preview(list){return memberHasFullAccess?list:list.slice(0,FREE_PREVIEW_LIMIT);}
function renderSummary(){const clear=results.filter(r=>r.applicability==='明确适用').length,conditional=results.filter(r=>r.applicability==='条件适用').length,review=results.filter(r=>r.applicability==='建议复核').length,clauses=results.reduce((n,r)=>n+r.matchedClauses.length,0);$('#summaryText').textContent=`识别 ${results.length} 项法规/标准，自动整理 ${clauses} 组条款要求。${clear} 项画像范围已匹配，${conditional} 项有适用条件，${review} 项仍缺范围信息或来源核验。条款组不是独立法规条数。`;$('#summaryTags').innerHTML=[[clear,'明确适用'],[conditional,'条件适用'],[review,'待补充/核验'],[clauses,'条款要求']].map(([n,label])=>`<span class="summary-tag">${n} ${label}</span>`).join('');const notice=$('#previewNotice');notice.textContent=memberHasFullAccess?`工具箱会员权益已验证：当前显示全部 ${results.length} 条结果，可导出完整结构化 Excel。`:`免费版显示完整摘要和前 ${Math.min(FREE_PREVIEW_LIMIT,results.length)} 条结果；工具箱会员可查看全部 ${results.length} 条并导出四表 Excel。`;notice.classList.toggle('member-active',memberHasFullAccess);renderGuidance();}
function renderGuidance(){
  const p=profile(),questions=Guidance.clarify(results,p),facts=Engine.profileFacts(p);
  if(p.legacyEnvironmentUnknown)for(const fact of ['产生废水','产生废气','产生工业噪声'])if(!facts.has(fact)&&!p.answers[fact])questions.unshift({fact,regulations:['旧画像环境选项需区分，未自动推断三者都有']});
  $('#clarificationCount').textContent=questions.length?`${questions.length} 个范围信息可补充`:'当前已匹配项目没有额外范围追问';
  const shown=questions.slice(0,8);
  $('#clarificationQuestions').innerHTML=shown.map(q=>`<label class="clarify-item"><span>是否${escape(q.fact)}？<small>${escape(q.regulations.slice(0,2).join('；'))}${q.regulations.length>2?`等 ${q.regulations.length} 项`:''}</small></span><select data-clarify="${escape(q.fact)}" aria-label="是否${escape(q.fact)}"><option value="unknown">不确定 / 未填写</option><option value="yes" ${p.answers[q.fact]==='yes'?'selected':''}>是</option><option value="no">否</option></select></label>`).join('')+(questions.length>8?'<p>先回答以上问题，系统会继续展示相关追问。不确定的项目可以保留。</p>':'');
  const answers=Object.entries(p.answers).filter(([,v])=>['yes','no'].includes(v));
  $('#answeredFacts').classList.toggle('hidden',!answers.length);
  $('#answeredFacts').innerHTML=answers.length?`<summary>已补充 ${answers.length} 项（可修改）</summary>`+answers.map(([fact,value])=>`<label class="clarify-item"><span>${escape(fact)}</span><select data-clarify="${escape(fact)}"><option value="unknown">不确定</option><option value="yes" ${value==='yes'?'selected':''}>是</option><option value="no" ${value==='no'?'selected':''}>否</option></select></label>`).join(''):'';
  $$('[data-clarify]').forEach(el=>el.onchange=()=>{if(el.value==='no')$$('#profileForm input[type=checkbox]').filter(x=>x.value===el.dataset.clarify).forEach(x=>x.checked=false);state.profile.answers={...(state.profile.answers||{}),[el.dataset.clarify]:el.value};if(Analytics)Analytics.track('profile_refined',usageMode);run(false);});
  $('#coverageItems').innerHTML=Guidance.coverage(results,p).map(c=>`<div><strong>${escape(c.name)}</strong><span>${c.matched} 项匹配${c.detailed!==undefined?` / ${c.detailed} 项有条款卡`:''}</span>${c.warning?`<small>${escape(c.warning)}</small>`:''}</div>`).join('');
  const retired=Object.keys(state.evaluations).filter(id=>!results.some(r=>r.id===id)&&state.evaluations[id].judgment&&state.evaluations[id].judgment!=='待评价');
  $('#versionNotice').textContent=`来源核验、企业适用性、实际符合性分别记录。${retired.length?`有 ${retired.length} 项历史评价因画像/版本变化不在本次结果中，已保留在本地及项目文件，未移植为新法规结论。`:''}`;
}
function filtered(){const q=$('#search').value.trim().toLowerCase(),l=$('#levelFilter').value,a=$('#appFilter').value,s=$('#statusFilter').value;return results.filter(r=>(!q||[r.name,r.documentNo,r.reasons.join(' ')].join(' ').toLowerCase().includes(q))&&(!l||r.type===l)&&(!a||r.applicability===a)&&(!s||r.computedStatus===s));}
function evalFor(id){return state.evaluations[id]||(state.evaluations[id]={evidence:'',judgment:'待评价',gap:'',action:'',owner:'',due:'',completedAt:'',verification:'',reviewDate:'',conversion:'未开始',primaryDepartment:'',cooperatingDepartments:'',evidenceRequirement:''});}
function requiredMissing(e){return Workflow.requiredMissing(e);}
function evaluationStatus(e){if(e.needsReassessment)return '版本已变，需重评';if(['符合','不适用'].includes(e.judgment)&&requiredMissing(e).length)return '待补充判定依据';return Workflow.evaluationStatus(e,Engine.cnToday(),Engine.daysBetween);}
function validateEvaluations(){const bad=results.filter(r=>state.selected[r.id]&&requiredMissing(evalFor(r.id)).length);if(!bad.length)return true;const first=bad[0],missing=requiredMissing(evalFor(first.id));show(`“${first.name}”缺少：${missing.join('、')}。请补充后再导出。`,'error');return false;}
function renderLedger(){
  const rows=preview(filtered());
  $('#focusedRequirement').classList.add('hidden');$('#focusedRequirement').innerHTML='';
  $('#quickResults').innerHTML=rows.map(r=>`<button type="button" class="quick-result" data-open-requirements="${r.id}"><strong>${escape(r.name)}</strong><span>${escape(r.applicability)} · ${r.matchedClauses.length} 组已整理条款</span><em>查看条款、要求与证据 →</em></button>`).join('');
  $('#ledgerBody').innerHTML=rows.length?rows.map((r,i)=>{
    const e=evalFor(r.id),departments=r.suggestedDepartment||[],checks=e.checks||{};
    const cards=r.matchedClauses.map(c=>{const check=checks[c.id]||{};return `<article class="clause-card"><h4>${escape(c.reference)}</h4><p>${escape(c.summary)}</p><p><strong>建议动作：</strong>${escape(c.action)}</p><p><strong>准备证据：</strong>${escape((c.evidence||[]).join('；'))}</p><a href="${escape(c.sourceUrl||r.sourceUrl)}" target="_blank" rel="noopener">官方条文 ↗</a><div class="evidence-check"><label>证据登记（非合规结论）<select data-check-state="${escape(c.id)}" data-id="${r.id}"><option value="unknown">尚未提供</option><option value="provided" ${check.state==='provided'?'selected':''}>已提供证据索引</option><option value="missing" ${check.state==='missing'?'selected':''}>已发现缺项</option></select></label><label>证据名称 / 日期 / 缺项说明<textarea maxlength="2000" data-check-note="${escape(c.id)}" data-id="${r.id}" placeholder="填写内部文件索引，不需要上传文件">${escape(check.note||'')}</textarea></label></div></article>`;}).join('');
    return `<tr><td><input class="row-select" data-id="${r.id}" type="checkbox" ${state.selected[r.id]?'checked':''}></td><td>${i+1}</td><td>${escape(r.type)}</td><td class="reg-name">${escape(r.name)}<small>${r.matchedClauses.length? r.matchedClauses.length+' 组条款已整理':'条款卡尚未覆盖'}</small></td><td>${escape(r.documentNo)}</td><td>${badge(r.computedStatus)}<small>${escape(r.sourceVerification)}</small></td><td>${escape(r.effectiveDate||'—')}</td><td>${badge(r.applicability)}<small>${escape(r.scopeApplicability||'')}</small></td><td class="reason">${escape(r.reasons.join('；'))}</td><td>${escape(e.primaryDepartment||departments[0]||'待指定')}</td><td><input class="review-date" data-id="${r.id}" type="date" value="${escape(e.reviewDate)}"></td><td>${badge(Engine.reviewReminder(e.reviewDate))}</td><td><a href="${escape(r.sourceUrl)}" target="_blank" rel="noopener">${escape(r.sourceName)}</a></td><td><button class="btn btn-secondary detail-btn" data-id="${r.id}">条款与要求</button></td></tr><tr class="detail-row" data-detail="${r.id}"><td colspan="14"><div class="auto-guidance"><h3>自动生成的适用性评价与落实清单</h3><p>${escape(r.evaluationDraft)}</p>${e.needsReassessment?'<p class="version-warning">法规版本或规则已更新，历史评价已保留，需按本版本重新评价。</p>':''}<p class="evidence-progress">${escape(Guidance.evidenceProgress(r,checks).label)}</p>${cards||`<p>${escape(r.requirementSummary)}</p>`}${r.pendingClauses.length?`<p>另有 ${r.pendingClauses.length} 组条件条款可在上方补充画像后判断。</p>`:''}</div><div class="detail-box"><div><dt>主责部门</dt><dd><input data-detail-edit="primaryDepartment" data-id="${r.id}" value="${escape(e.primaryDepartment||departments[0]||'')}"></dd></div><div><dt>协同部门</dt><dd><input data-detail-edit="cooperatingDepartments" data-id="${r.id}" value="${escape(e.cooperatingDepartments||departments.slice(1).join('、'))}"></dd></div><div><dt>转化落实情况</dt><dd><select data-detail-edit="conversion" data-id="${r.id}">${['未开始','制度修订中','已转化','不适用'].map(v=>`<option ${e.conversion===v?'selected':''}>${v}</option>`).join('')}</select></dd></div><div><dt>证据要求（自动建议可编辑）</dt><dd><textarea data-detail-edit="evidenceRequirement" data-id="${r.id}">${escape(e.evidenceRequirement||r.evidenceRequirement||'')}</textarea></dd></div><div><dt>结果反馈</dt><dd><a href="../feedback.html?type=content_issue&amp;tool=compliance-identification&amp;entry=result&amp;id=${encodeURIComponent(r.id)}&amp;toolVersion=1.6.0&amp;dataVersion=1.6.0" data-feedback-open data-feedback-tool="compliance-identification" data-feedback-entry="result" data-public-entry-id="${escape(r.id)}" data-tool-version="1.6.0" data-data-version="1.6.0">这条结果有疑问？反馈</a></dd></div></div></td></tr>`;
  }).join(''):'<tr><td colspan="14" class="empty">没有匹配结果，请调整画像或筛选条件。</td></tr>';
  bindTable();
  $$('[data-open-requirements]').forEach(el=>el.onclick=()=>{const id=el.dataset.openRequirements;renderLedger();const r=results.find(x=>x.id===id),row=$(`[data-detail="${id}"]`),panel=$('#focusedRequirement');panel.innerHTML=`<div class="focused-head"><h2>${escape(r.name)}</h2><button type="button" class="btn btn-secondary" id="closeRequirements">收起条款</button></div>`+row.querySelector('.auto-guidance').outerHTML;panel.classList.remove('hidden');$('#closeRequirements').onclick=()=>panel.classList.add('hidden');bindEvidenceChecks();panel.scrollIntoView({behavior:'smooth',block:'start'});if(Analytics)Analytics.track('detail_opened',usageMode);});
  bindEvidenceChecks();
}
function bindEvidenceChecks(){
  $$('[data-check-state],[data-check-note]').forEach(el=>{const update=event=>{
    const e=evalFor(el.dataset.id),id=el.dataset.checkState||el.dataset.checkNote;
    e.checks=e.checks||{};e.checks[id]=e.checks[id]||{};e.checks[id][el.dataset.checkState?'state':'note']=el.value;save();
    const r=results.find(x=>x.id===el.dataset.id);
    el.closest('.auto-guidance').querySelector('.evidence-progress').textContent=Guidance.evidenceProgress(r,e.checks).label;
    if(Analytics&&event.type==='change')Analytics.track('evidence_recorded',usageMode);
  };el.onchange=update;if(el.dataset.checkNote)el.oninput=update;});
}
function renderEvaluation(){const selected=preview(results.filter(r=>state.selected[r.id]));$('#evaluationBody').innerHTML=selected.map(r=>{const e=evalFor(r.id),missing=requiredMissing(e),rowClass=e.judgment==='不符合'?'row-noncompliant':e.judgment==='基本符合'?'row-partial':'',required=missing.length?'field-required':'';return `<tr class="${rowClass}"><td class="reg-name">${escape(r.name)}<br><small>${escape(r.documentNo)}</small></td><td>${escape(r.requirementSummary)}<small>${escape(r.evaluationDraft)}</small>${e.needsReassessment?'<strong class="version-warning">版本已变，历史判定需重评</strong>':''}</td><td><textarea data-edit="evidence" data-id="${r.id}">${escape(e.evidence)}</textarea></td><td><select data-edit="judgment" data-id="${r.id}">${['待评价','符合','基本符合','不符合','不适用'].map(v=>`<option ${e.judgment===v?'selected':''}>${v}</option>`).join('')}</select></td><td><textarea class="${required&&!e.gap?required:''}" data-edit="gap" data-id="${r.id}">${escape(e.gap)}</textarea></td><td><textarea class="${required&&!e.action?required:''}" data-edit="action" data-id="${r.id}">${escape(e.action)}</textarea></td><td><input class="${required&&!e.owner?required:''}" data-edit="owner" data-id="${r.id}" value="${escape(e.owner)}"></td><td><input class="${required&&!e.due?required:''}" type="date" data-edit="due" data-id="${r.id}" value="${escape(e.due)}"></td><td><input type="date" data-edit="completedAt" data-id="${r.id}" value="${escape(e.completedAt)}"></td><td><textarea data-edit="verification" data-id="${r.id}">${escape(e.verification)}</textarea></td><td>${badge(evaluationStatus(e))}${missing.length?`<small class="validation-note">需补：${escape(missing.join('、'))}</small>`:''}</td></tr>`}).join('');bindEdits();}
function updateRecord(c){return {matchedClauses:[],pendingClauses:[],missingFacts:[],evidenceRequirement:'',sourceVerification:'候选版本尚待核验',evaluationDraft:'新增候选条目尚未形成条款检查清单，不自动判定适用或符合。',id:`UPDATE-${c.documentNo.replace(/\W/g,'')}`,name:c.name,documentNo:c.documentNo,type:'行业标准',levelRank:4,issuingAuthority:c.source,status:'已发布待实施',publishDate:c.publishDate,effectiveDate:c.effectiveDate,sourceUrl:c.sourceUrl,sourceName:c.source,sourceType:c.source,regions:['全国'],applicabilityType:'条件触发',verificationStatus:'待复核',complianceEnabled:true,changeType:c.changeType,replaces:[],requirementSummary:'新发布候选法规，适用性与具体条款需人工确认。',applicableClauses:'需人工确认',suggestedDepartment:['EHS部门'],reasons:['用户从法规动态跟踪加入台账；适用性尚待人工复核'],applicability:'建议复核',computedStatus:Engine.implementationStatus({verificationStatus:'待复核',status:'已发布待实施',effectiveDate:c.effectiveDate},Engine.cnToday())};}
function addUpdate(no){const c=changes.find(x=>x.documentNo===no);if(!c||state.addedUpdates.includes(no))return;const r=updateRecord(c);state.addedUpdates.push(no);regulations.push(r);results.push(r);state.selected[r.id]=true;save();renderAll();show(`已将“${c.name}”作为待复核记录加入台账。`);}
function renderTracking(){const current=results.filter(r=>r.changeType&&r.changeType!=='无变化'||r.computedStatus==='即将实施'),known=new Set(results.map(r=>r.documentNo)),incoming=changes.map(updateRecord),list=preview([...current,...incoming.filter(r=>!current.some(x=>x.documentNo===r.documentNo))]);$('#trackingBody').innerHTML=list.map(r=>{const inLedger=known.has(r.documentNo),distance=Engine.implementationDistanceLabel(r.effectiveDate),days=Engine.daysBetween(Engine.cnToday(),r.effectiveDate),e=evalFor(r.id),conversionDone=['已转化','不适用'].includes(e.conversion),urgency=days!==null&&days<=0&&!conversionDone?'track-danger':days!==null&&days<30?'track-danger':days!==null&&days<=90?'track-warning':'track-ok';return `<tr><td>${escape(r.lastVerifiedAt||r.publishDate||'—')}</td><td>${escape(r.sourceName)}</td><td class="reg-name">${escape(r.name)}</td><td>${escape(r.changeType||'待复核')}</td><td>${escape((r.replaces||[]).join('、')||'—')}</td><td>${escape(r.documentNo)}</td><td>${escape(r.effectiveDate||'—')}</td><td>${badge(r.computedStatus)}</td><td class="${urgency}">${escape(distance)}</td><td>需要人工评估</td><td>核对适用条款并更新内部文件</td><td>${escape(e.owner||'待指定')}</td><td>${inLedger?'<span class="badge badge-current">已在台账</span>':`<button class="btn btn-secondary add-update" data-no="${escape(r.documentNo)}">加入台账</button>`}</td><td><a class="source-link" href="${escape(r.sourceUrl)}" target="_blank" rel="noopener">查看</a></td></tr>`}).join('');$$('.add-update').forEach(el=>el.onclick=()=>addUpdate(el.dataset.no));}
function renderAll(){renderStats();renderSummary();renderLedger();renderEvaluation();renderTracking();}
function bindTable(){$$('.row-select').forEach(el=>el.onchange=()=>{state.selected[el.dataset.id]=el.checked;save();renderStats();renderEvaluation();renderTracking();});$$('.review-date').forEach(el=>el.onchange=()=>{evalFor(el.dataset.id).reviewDate=el.value;save();renderLedger();});$$('.detail-btn').forEach(el=>el.onclick=()=>{document.querySelector(`[data-detail="${el.dataset.id}"]`).classList.toggle('open');if(Analytics)Analytics.track('detail_opened',usageMode);});$$('[data-detail-edit]').forEach(el=>el.onchange=()=>{evalFor(el.dataset.id)[el.dataset.detailEdit]=el.value;save();renderLedger();renderTracking();});}
function bindEdits(){$$('[data-edit]').forEach(el=>el.onchange=()=>{evalFor(el.dataset.id)[el.dataset.edit]=el.value;if(el.dataset.edit==='judgment')evalFor(el.dataset.id).needsReassessment=false;save();renderStats();renderEvaluation();});}
function download(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function exportExcel(){if(!window.ExcelJS||!Exporter){show('Excel 组件加载失败，请刷新后重试。','error');return;}const selected=results.filter(r=>state.selected[r.id]);if(!selected.length){show('请至少勾选一条法规。','error');return;}if(!validateEvaluations())return;try{const wb=Exporter.buildWorkbook(window.ExcelJS,{profile:profile(),selected,evaluations:state.evaluations,meta:databaseMeta,today:Engine.cnToday(),statusFor:evaluationStatus,reminderFor:d=>Engine.reviewReminder(d),distanceFor:d=>Engine.implementationDistanceLabel(d)}),buf=await wb.xlsx.writeBuffer(),name=profile().companyName.replace(/[\\/:*?"<>|]/g,'_');download(buf,`EHS合规识别台账_${name}_${Engine.cnToday()}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');if(Analytics)Analytics.track('excel_exported',usageMode);show('Excel 已生成，包含四个可直接维护的工作表。');}catch(e){console.error(e);show('Excel 生成失败，请刷新后重试。','error');}}
function exportProject(){if(!validateEvaluations())return;const project=Workflow.createProject({profile:profile(),selected:state.selected,evaluations:state.evaluations,addedUpdates:state.addedUpdates,updatedAt:new Date().toISOString()});download(JSON.stringify(project,null,2),`EHS合规项目_${(project.profile.companyName||'未命名').replace(/[\\/:*?"<>|]/g,'_')}_${Engine.cnToday()}.ehsproject.json`,'application/json');show('项目文件已导出，仅包含当前浏览器中的项目数据。');}
function importProject(file){if(file.size>3*1024*1024){show('项目文件超过3MB，请检查文件是否正确。','error');return;}const reader=new FileReader();reader.onload=()=>{try{const p=Workflow.validateProject(JSON.parse(reader.result));if(!confirm('导入将覆盖当前浏览器中的项目数据，是否继续？'))return;state={profile:p.profile,evaluations:p.evaluations,selected:Object.fromEntries(p.selectedRegulationIds.map(id=>[id,true])),addedUpdates:p.addedUpdates||[],updatedAt:p.updatedAt||''};localStorage.setItem(KEY,JSON.stringify(state));location.reload();}catch(e){show(`项目导入失败：${e.message}`,'error');}};reader.onerror=()=>show('项目文件读取失败，请重新选择。','error');reader.readAsText(file);}
function openMemberGate(){const modal=$('#memberExportModal');modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');$('#memberLoginLink').focus();if(Analytics)Analytics.track('vip_prompt_viewed',usageMode);}
function closeMemberGate(){const modal=$('#memberExportModal');modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
async function withExportCapability(action){const hint=$('#membershipHint');if(hint)hint.textContent='正在验证会员权益…';try{if(window.EhsSilVip&&await window.EhsSilVip.hasCapability(EXPORT_CAPABILITY,true)){memberHasFullAccess=true;if(hint)hint.textContent='工具箱会员权益已验证，可查看全部结果并下载专业文件';renderAll();return action();}}catch(e){console.warn('Membership capability check failed',e);}memberHasFullAccess=false;if(hint)hint.textContent='在线识别免费；完整结果、专业 Excel 与项目文件为会员权益';renderAll();openMemberGate();}
async function refreshMembershipHint(){const previous=memberHasFullAccess,hint=$('#membershipHint');if(!hint)return;try{const session=window.EhsSilVip?await window.EhsSilVip.getSession(true):null;memberHasFullAccess=Boolean(session&&session.active&&Array.isArray(session.capabilities)&&session.capabilities.includes(EXPORT_CAPABILITY));hint.textContent=memberHasFullAccess?'工具箱会员权益已验证，可查看全部结果并下载专业文件':'在线识别免费；完整结果、专业 Excel 与项目文件为会员权益';hint.classList.toggle('member-active',memberHasFullAccess);if(results.length&&previous!==memberHasFullAccess)renderAll();}catch(e){memberHasFullAccess=false;hint.textContent='在线识别免费；完整结果、专业 Excel 与项目文件为会员权益';if(results.length&&previous!==memberHasFullAccess)renderAll();}}
async function init(){
  renderChoices();
  try{
    const get=path=>fetch(`${path}?v=1.6.0`).then(r=>{if(!r.ok)throw Error(path);return r.json()});
    const [formal,candidates,ruleData,changeData,environment,safety,corrections]=await Promise.all([get('../data/compliance/laws.v1.json'),get('../data/compliance/candidates.v1.json'),get('../data/compliance/rules.v1.json'),get('../data/compliance/changes.v1.json'),get('../data/compliance/environment.v1.6.json'),get('../data/compliance/safety.v1.6.json'),get('../data/compliance/scope-corrections.v1.6.json')]);
    const baseRules=new Map(ruleData.rules.map(r=>[r.regulationId,r]));
    for(const r of corrections.rules)baseRules.set(r.regulationId,{...baseRules.get(r.regulationId),...r});
    const merged=Guidance.mergeCatalog([...formal.records,...candidates.records],[...baseRules.values()],[environment,safety]);
    regulations=merged.records;rules=merged.rules;changes=(changeData.candidates||[]).filter(c=>!regulations.some(r=>r.documentNo===c.documentNo));
    const active=regulations.filter(r=>r.complianceEnabled&&Engine.implementationStatus(r,Engine.cnToday())!=='已废止');
    databaseMeta={schemaVersion:'1.6.0',total:active.length,verified:active.filter(r=>r.verificationStatus==='已核验').length,latestVerifiedAt:[formal.latestVerifiedAt,environment.checkedAt,safety.checkedAt].sort().at(-1)};
    $('#databaseCount').textContent=databaseMeta.total;$('#verifiedCount').textContent=databaseMeta.verified;$('#latestVerifiedAt').textContent=databaseMeta.latestVerifiedAt;
    dataReady=true;restore();refreshMembershipHint();
  }catch(e){$('#initialState').innerHTML='<strong>法规数据加载不完整</strong><span>为避免用旧法规生成新结论，本次已停止识别。请刷新后重试。</span>';$('#identifyBtn').disabled=true;console.error(e);}
}
$('#nextBtn').onclick=()=>{if(validateStep())setStep(step+1)};$('#prevBtn').onclick=()=>setStep(step-1);$('#identifyBtn').onclick=()=>{usageMode='user';run();};$('#exampleBtn').onclick=()=>{usageMode='example';if(Analytics)Analytics.track('example_used','example');$('#companyName').value='淄博示例化工有限公司';$('#province').value='山东省';$('#city').value='淄博市';$$('#profileForm input[type=checkbox]').forEach(el=>el.checked=false);state.profile.answers={};const sample={enterpriseTypes:['危险化学品使用企业'],industries:['化学原料和化学制品制造'],riskTags:['涉及特殊作业','存在职业病危害','产生废水','产生废气','产生工业噪声','产生一般固体废物或危险废物'],specialOperationTypes:['涉及动火作业','涉及受限空间作业','涉及高处作业','涉及临时用电'],hazardousActivities:['危化品使用','危化品储存'],environmentalActivities:['排放工业废水','废水间接排放','排放VOCs','产生一般工业固体废物'],regulatoryAttributes:['排污许可重点管理'],workplaceActivities:['涉及有限空间','涉及特种作业人员'],hazardousWasteActivities:['危废产生','危废暂存'],specialEquipmentTypes:['压力容器'],industryAttributes:['化工属性']};Object.entries(sample).forEach(([name,values])=>values.forEach(v=>{const el=document.querySelector(`[name="${name}"][value="${v}"]`);if(el)el.checked=true;}));setStep(2);run();};$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.tab-panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');$('#'+t.dataset.tab).classList.add('active');});['search','levelFilter','appFilter','statusFilter'].forEach(id=>$('#'+id).oninput=renderLedger);$('#selectAll').onchange=e=>{preview(filtered()).forEach(r=>state.selected[r.id]=e.target.checked);save();renderAll();};$('#printBtn').onclick=()=>window.print();const requestExcelExport=()=>{if(Analytics)Analytics.track('export_clicked',usageMode);withExportCapability(exportExcel);};$('#exportBtn').onclick=requestExcelExport;$('#summaryExportBtn').onclick=requestExcelExport;$('#exportProjectBtn').onclick=()=>withExportCapability(exportProject);$('#importProjectBtn').onclick=()=>withExportCapability(()=>$('#projectFile').click());$('#projectFile').onchange=e=>{if(e.target.files[0])importProject(e.target.files[0]);e.target.value='';};$('#memberModalClose').onclick=closeMemberGate;$('#memberExportModal').onclick=e=>{if(e.target.id==='memberExportModal')closeMemberGate();};$('#memberLoginLink').onclick=()=>{if(Analytics)Analytics.track('vip_entry_clicked',usageMode);};$('#memberPlanetLink').onclick=()=>{if(Analytics)Analytics.track('knowledge_planet_clicked',usageMode);};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#memberExportModal').classList.contains('hidden'))closeMemberGate();});$('#clearBtn').onclick=()=>{if(confirm('确定清除本浏览器保存的企业画像和评价内容吗？')){localStorage.removeItem(KEY);location.reload();}};init();
})();

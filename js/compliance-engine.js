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

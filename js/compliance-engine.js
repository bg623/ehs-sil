(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceEngine=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const applicabilityRank={"明确适用":0,"条件适用":1,"建议复核":2,"不纳入":3};
  const statusRank={"即将实施":0,"现行有效":1,"已发布待实施":2,"部分失效":3,"待核实":4,"已废止":5};
  function cnToday(now){const parts=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now||new Date());const get=t=>parts.find(p=>p.type===t).value;return `${get("year")}-${get("month")}-${get("day")}`;}
  function daysBetween(from,to){if(!from||!to)return null;const a=Date.parse(from+"T00:00:00+08:00"),b=Date.parse(to+"T00:00:00+08:00");return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;}
  function implementationStatus(reg,today){if(reg.status==="已废止"||reg.expiryDate&&daysBetween(today,reg.expiryDate)<0)return "已废止";if(!reg.effectiveDate)return reg.status||"待核实";const d=daysBetween(today,reg.effectiveDate);if(d>90)return "已发布待实施";if(d>0)return "即将实施";return reg.status==="部分失效"?"部分失效":"现行有效";}
  function reviewReminder(date,today){if(!date)return "未设置";const d=daysBetween(today||cnToday(),date);if(d<0)return "已逾期";if(d<=30)return "30日内到期";if(d<=90)return "即将评审";return "正常";}
  function implementationDistanceLabel(date,today){const d=daysBetween(today||cnToday(),date);if(d===null)return "日期待核实";return d>0?`距实施 ${d} 天`:d===0?"今日实施":`已实施 ${Math.abs(d)} 天`;}
  function intersects(a,b){return (a||[]).some(v=>(b||[]).includes(v));}
  function profileFacts(profile){return new Set(["生产经营单位",...(profile.enterpriseTypes||[]),...(profile.industries||[]),...(profile.riskTags||[]),...(profile.specialOperationTypes||[]),...(profile.hazardousActivities||[]),...(profile.hazardousWasteActivities||[]),...(profile.specialEquipmentTypes||[]),...(profile.industryAttributes||[]),...(profile.managementCommitments||[])]);}
  function matchByRule(reg,profile,today,rule){
    if(!reg.complianceEnabled||implementationStatus(reg,today)==="已废止")return {applicability:"不纳入",reasons:[]};
    const reasons=[],facts=profileFacts(profile);let applicability="不纳入";
    const regionMatch=(reg.regions||[]).includes("全国")||(reg.regions||[]).includes(profile.province)||(reg.regions||[]).includes(profile.city);
    if(reg.applicabilityType==="地方要求"&&!regionMatch)return {applicability:"不纳入",reasons:[]};
    if((rule.excludeAny||[]).some(x=>facts.has(x)))return {applicability:"不纳入",reasons:["企业画像命中排除条件"]};
    const allList=rule.includeAll||[],anyList=rule.includeAny||[],hasTrigger=allList.length>0||anyList.length>0,allHit=allList.every(x=>facts.has(x)),anyHit=!anyList.length||anyList.some(x=>facts.has(x)),directHit=hasTrigger&&allHit&&anyHit,reviewHit=(rule.reviewWhen||[]).some(x=>facts.has(x));
    if(directHit){applicability=rule.applicability==="mandatory"?"明确适用":"条件适用";const hits=[...(rule.includeAll||[]),...anyList.filter(x=>facts.has(x))];reasons.push(`${rule.explanationTemplate}${hits.length?`：${hits.join("、")}`:""}`);}
    else if(reviewHit){applicability="建议复核";reasons.push(`信息不足，需进一步确认：${(rule.reviewWhen||[]).filter(x=>facts.has(x)).join("、")}`);}
    if(applicability!=="不纳入"&&reg.applicabilityType==="地方要求")reasons.unshift(`企业所在地为${profile.city||profile.province}`);
    if(applicability!=="不纳入"&&reg.verificationStatus!=="已核验"){applicability="建议复核";reasons.push("候选法规元数据或适用规则尚待人工复核，不作为正式适用结论");}
    return {applicability,reasons};
  }
  function matchOne(reg,profile,today,rule){if(rule)return matchByRule(reg,profile,today,rule);const fallback={includeAll:reg.applicabilityType==="通用基础"?["生产经营单位"]:[],includeAny:[...(reg.enterpriseTypes||[]),...(reg.industries||[]),...(reg.riskTags||[]),...(reg.activityTags||[])],excludeAny:[],reviewWhen:reg.reviewWhenInsufficient?["使用或储存危险化学品"]:[],applicability:reg.scaleConditions&&reg.scaleConditions.length?"conditional":"mandatory",explanationTemplate:"企业画像命中现有标签"};return matchByRule(reg,profile,today,fallback);}
  function identify(regulations,profile,options){const today=(options&&options.today)||cnToday(),ruleMap=new Map(((options&&options.rules)||[]).map(r=>[r.regulationId,r]));return regulations.map(r=>{const m=matchOne(r,profile,today,ruleMap.get(r.id));return {...r,...m,computedStatus:implementationStatus(r,today)};}).filter(r=>(options&&options.includeExcluded)||r.applicability!=="不纳入").sort((a,b)=>(a.levelRank-b.levelRank)||(applicabilityRank[a.applicability]-applicabilityRank[b.applicability])||(statusRank[a.computedStatus]-statusRank[b.computedStatus])||a.name.localeCompare(b.name,"zh-CN"));}
  return {cnToday,daysBetween,implementationStatus,implementationDistanceLabel,reviewReminder,profileFacts,matchOne,identify};
});

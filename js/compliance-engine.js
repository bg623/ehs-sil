(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceEngine=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const applicabilityRank={"明确适用":0,"条件适用":1,"建议复核":2,"不纳入":3};
  const statusRank={"即将实施":0,"现行有效":1,"已发布待实施":2,"部分失效":3,"待核实":4,"已废止":5};
  function cnToday(now){const parts=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now||new Date());const get=t=>parts.find(p=>p.type===t).value;return `${get("year")}-${get("month")}-${get("day")}`;}
  function daysBetween(from,to){if(!from||!to)return null;const a=Date.parse(from+"T00:00:00+08:00"),b=Date.parse(to+"T00:00:00+08:00");return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):null;}
  function implementationStatus(reg,today){if(reg.status==="已废止"||reg.expiryDate&&daysBetween(today,reg.expiryDate)<0)return "已废止";if(!reg.effectiveDate)return reg.status||"待核实";const d=daysBetween(today,reg.effectiveDate);if(d>90)return "已发布待实施";if(d>0)return "即将实施";return reg.status==="部分失效"?"部分失效":"现行有效";}
  function reviewReminder(date,today){if(!date)return "未设置";const d=daysBetween(today||cnToday(),date);if(d<0)return "已逾期";if(d<=30)return "30日内到期";if(d<=90)return "即将评审";return "正常";}
  function intersects(a,b){return (a||[]).some(v=>(b||[]).includes(v));}
  function matchOne(reg,profile,today){
    if(!reg.complianceEnabled||implementationStatus(reg,today)==="已废止")return {applicability:"不纳入",reasons:[]};
    const reasons=[];let applicability="不纳入";
    const regionMatch=(reg.regions||[]).includes("全国")||(reg.regions||[]).includes(profile.province)||(reg.regions||[]).includes(profile.city);
    if(reg.applicabilityType==="地方要求"){
      if(!regionMatch)return {applicability:"不纳入",reasons:[]};
      const localTrigger=intersects(reg.industries,profile.industries)||intersects(reg.enterpriseTypes,profile.enterpriseTypes)||intersects(reg.riskTags,profile.riskTags)||intersects(reg.activityTags,profile.activityTags)||(reg.industries||[]).includes("全部行业");
      if(!localTrigger)return {applicability:"不纳入",reasons:[]};
      applicability=reg.scaleConditions&&reg.scaleConditions.length?"条件适用":"明确适用";reasons.push(`企业所在地为${profile.city||profile.province}`);
    }else if(reg.applicabilityType==="通用基础"){
      applicability="明确适用";reasons.push("属于生产经营单位通用要求");
    }else{
      const enterpriseHit=intersects(reg.enterpriseTypes,profile.enterpriseTypes);
      const industryHit=intersects(reg.industries,profile.industries);
      const riskHit=intersects(reg.riskTags,profile.riskTags);
      const activityHit=intersects(reg.activityTags,profile.activityTags);
      if(enterpriseHit){applicability="明确适用";reasons.push(`企业类型触发：${reg.enterpriseTypes.filter(v=>profile.enterpriseTypes.includes(v)).join("、")}`);}
      if(industryHit){applicability=applicability==="不纳入"?"明确适用":applicability;reasons.push(`行业触发：${reg.industries.filter(v=>profile.industries.includes(v)).join("、")}`);}
      if(riskHit){applicability=applicability==="不纳入"?"明确适用":applicability;reasons.push(`风险特征触发：${reg.riskTags.filter(v=>profile.riskTags.includes(v)).join("、")}`);}
      if(activityHit){applicability=applicability==="不纳入"?"明确适用":applicability;reasons.push(`作业活动触发：${reg.activityTags.filter(v=>profile.activityTags.includes(v)).join("、")}`);}
      if(applicability!=="不纳入"&&!enterpriseHit&&(reg.enterpriseTypes||[]).length){applicability="条件适用";reasons.push("企业类型未直接命中，需结合物料数量、许可、工艺和适用范围复核");}
      if(applicability!=="不纳入"&&reg.scaleConditions&&reg.scaleConditions.length){applicability="条件适用";reasons.push(reg.scaleConditions.join("；"));}
    }
    if(applicability==="不纳入"&&reg.reviewWhenInsufficient&&((profile.enterpriseTypes||[]).length||(profile.riskTags||[]).length)){applicability="建议复核";reasons.push(reg.reviewWhenInsufficient);}
    if(applicability!=="不纳入"&&reg.verificationStatus!=="已核验"){reasons.push("法规元数据待产品负责人复核");}
    return {applicability,reasons};
  }
  function identify(regulations,profile,options){const today=(options&&options.today)||cnToday();return regulations.map(r=>{const m=matchOne(r,profile,today);return {...r,...m,computedStatus:implementationStatus(r,today)};}).filter(r=>(options&&options.includeExcluded)||r.applicability!=="不纳入").sort((a,b)=>(a.levelRank-b.levelRank)||(applicabilityRank[a.applicability]-applicabilityRank[b.applicability])||(statusRank[a.computedStatus]-statusRank[b.computedStatus])||a.name.localeCompare(b.name,"zh-CN"));}
  return {cnToday,daysBetween,implementationStatus,reviewReminder,matchOne,identify};
});

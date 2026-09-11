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

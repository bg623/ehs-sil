import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import test from "node:test";

const require=createRequire(import.meta.url),Engine=require("../js/compliance-engine.js"),Guidance=require("../js/compliance-guidance.js");
const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/compliance/${name}`,import.meta.url),"utf8"));
const baseRecords=[...read("laws.v1.json").records,...read("candidates.v1.json").records],baseRules=read("rules.v1.json").rules;
const corrections=read("scope-corrections.v1.6.json"),packs=[read("environment.v1.6.json"),read("safety.v1.6.json")];
const correctedRules=new Map(baseRules.map(r=>[r.regulationId,r]));
for(const rule of corrections.rules)correctedRules.set(rule.regulationId,{...correctedRules.get(rule.regulationId),...rule});
const catalog=Guidance.mergeCatalog(baseRecords,[...correctedRules.values()],packs);
const identify=(profile,options={})=>Engine.identify(catalog.records,{province:"江苏省",...profile},{rules:catalog.rules,today:"2026-09-11",...options});
const pick=(results,id)=>results.find(r=>r.id===id);
const synthetic={id:"SYNTHETIC",name:"合成测试法规",documentNo:"TEST-1",levelRank:1,regions:["全国"],applicabilityType:"条件触发",complianceEnabled:true,verificationStatus:"已核验",status:"现行有效",effectiveDate:"2020-01-01"};

test("scope corrections change only scope, not verification or legal metadata",()=>{
  assert.equal(corrections.schemaVersion,"1.6.0");
  assert.equal(new Set(corrections.rules.map(r=>r.regulationId)).size,corrections.rules.length);
  for(const rule of corrections.rules){
    assert.ok(baseRecords.some(r=>r.id===rule.regulationId),rule.regulationId);
    for(const key of ["includeAll","includeAny","excludeAny","reviewWhen"])assert.ok(Array.isArray(rule[key]));
    for(const key of ["verificationStatus","lastVerifiedAt","name","sourceUrl","effectiveDate"])assert.equal(rule[key],undefined);
    assert.notEqual(rule.applicability,"mandatory","unverified scope corrections do not invent a mandatory conclusion");
  }
});

test("ordinary manufacturing does not inherit pharmaceutical, X-ray, blasting or design tasks",()=>{
  const found=identify({enterpriseTypes:["机械制造企业"],industries:["通用设备制造"]});
  for(const id of ["REG-139","REG-140","REG-111","REG-077","REG-NEW-005","REG-043","REG-052","REG-113","REG-114","REG-129","REG-130"])assert.equal(pick(found,id),undefined,id);
});

test("occupational exposure surfaces health monitoring, not medical radiation",()=>{
  const found=identify({enterpriseTypes:["机械制造企业"],riskTags:["存在职业病危害"]});
  assert.ok(pick(found,"REG-NEW-006"));
  assert.equal(pick(found,"REG-111"),undefined);
  assert.ok(!pick(found,"REG-NEW-006").reasons.join(" ").includes("地下水污染防治重点活动"));
  const groundwater=identify({industries:["化学原料和化学制品制造"],hazardousWasteActivities:["危废填埋"]});
  assert.equal(pick(groundwater,"REG-NEW-006"),undefined,"groundwater activities are not occupational monitoring evidence");
});

test("coarse special operations and contractors do not imply blasting or chemical maintenance",()=>{
  const found=identify({enterpriseTypes:["机械制造企业"],riskTags:["涉及特殊作业","使用承包商"],specialOperationTypes:["涉及动火作业"]});
  for(const id of ["REG-077","REG-NEW-005","REG-017"])assert.equal(pick(found,id),undefined,id);
});

test("chemical maintenance requires both chemical scope and the maintenance activity",()=>{
  const incomplete=pick(identify({industryAttributes:["化工属性"]}),"REG-NEW-005");
  assert.ok(incomplete);assert.equal(incomplete.applicability,"建议复核");assert.ok(incomplete.missingFacts.includes("设备检修作业"));
  const complete=pick(identify({industryAttributes:["化工属性"],workplaceActivities:["设备检修作业"]}),"REG-NEW-005");
  assert.equal(complete.scopeApplicability,"画像条件匹配");assert.equal(complete.applicability,"条件适用");
  assert.equal(pick(identify({industryAttributes:["化工属性"],answers:{设备检修作业:"no"}}),"REG-NEW-005"),undefined);
});

test("pharmaceutical industry alone does not make GB45673 directly applicable",()=>{
  const partial=pick(identify({industries:["医药制造"]}),"REG-NEW-002");
  assert.ok(partial);assert.equal(partial.scopeApplicability,"范围信息待补充");assert.equal(partial.applicability,"建议复核");
  const activity=pick(identify({hazardousActivities:["危化品生产"]}),"REG-NEW-002");
  assert.equal(activity.scopeApplicability,"画像条件匹配");assert.notEqual(activity.applicability,"明确适用");
});

test("a precise candidate match does not verify its metadata",()=>{
  const found=identify({answers:{药品生产活动:"yes"}}),candidate=pick(found,"REG-139");
  assert.ok(candidate);assert.equal(candidate.computedStatus,"待核实");assert.equal(candidate.sourceVerification,"版本/来源尚待核验");assert.equal(candidate.scopeApplicability,"画像条件匹配");
  const denied=identify({industries:["医药制造"],answers:{药品生产活动:"no",药品上市许可持有人:"no"}});
  assert.equal(pick(denied,"REG-139"),undefined);assert.equal(pick(denied,"REG-140"),undefined);
});

test("fixed and mobile pressure vessels are not automatically interchangeable",()=>{
  const found=identify({specialEquipmentTypes:["压力容器"],answers:{固定式压力容器:"yes",移动式压力容器:"no"}});
  assert.equal(pick(found,"REG-124").scopeApplicability,"画像条件匹配");assert.equal(pick(found,"REG-125"),undefined);
});

test("official enhancement packs take priority over conservative candidate quarantine",()=>{
  const correctedOnly=Engine.identify(baseRecords,{province:"江苏省",regulatoryAttributes:["建设项目新改扩建"]},{rules:[...correctedRules.values()],today:"2026-09-11"});
  assert.equal(pick(correctedOnly,"REG-121"),undefined);
  const upgraded=pick(identify({regulatoryAttributes:["建设项目新改扩建"]}),"REG-121");
  assert.equal(upgraded.name,"建设项目环境保护管理条例");assert.equal(upgraded.verificationStatus,"已核验");
  assert.ok(!identify({}).some(r=>r.name==="中华人民共和国环境保护法实施条例"));
});

test("local rules do not leak to another province",()=>{
  assert.equal(pick(identify({province:"江苏省"}),"REG-SD-001"),undefined);
  assert.ok(pick(identify({province:"山东省"}),"REG-SD-001"));
});

test("unknown and explicit no are distinct for questions and clause cards",()=>{
  const record={...synthetic,clauses:[{id:"BASE",reference:"第一条",summary:"基础义务",evidence:["基础台账"]},{id:"VOC",reference:"第二条",summary:"VOCs控制",whenAll:["排放VOCs"],evidence:["VOCs记录"]}]};
  const rule={regulationId:record.id,includeAll:["生产经营单位"],includeAny:[],reviewWhen:[],excludeAny:[],applicability:"mandatory",explanationTemplate:"合成范围"};
  const get=answers=>Engine.identify([record],{answers},{rules:[rule],today:"2026-09-11"})[0];
  const unknown=get({}),no=get({排放VOCs:"no"}),yes=get({排放VOCs:"yes"});
  assert.deepEqual(unknown.matchedClauses.map(c=>c.id),["BASE"]);assert.deepEqual(unknown.pendingClauses.map(c=>c.id),["VOC"]);
  assert.ok(Guidance.clarify([unknown],{}).some(x=>x.fact==="排放VOCs"));
  assert.equal(no.pendingClauses.length,0);assert.equal(no.missingFacts.length,0);
  assert.deepEqual(yes.matchedClauses.map(c=>c.id),["BASE","VOC"]);assert.match(yes.evidenceRequirement,/VOCs记录/);
  assert.match(yes.evaluationDraft,/不自动判定符合/);
});

test("unverified dates do not masquerade as a verified current legal status",()=>{
  assert.equal(Engine.implementationStatus({...synthetic,verificationStatus:"待复核",effectiveDate:"2001-01-01"},"2026-09-11"),"待核实");
});

test("replacement applies only on and after its effective date",()=>{
  const old={...synthetic,id:"OLD"},next={...synthetic,id:"NEXT",documentNo:"TEST-2",effectiveDate:"2026-10-01",replaces:["OLD"]};
  const merged=Guidance.mergeCatalog([old],[],[{schemaVersion:"1.6.0",records:[next]}]),prior=merged.records.find(r=>r.id==="OLD");
  assert.equal(Engine.implementationStatus(prior,"2026-09-30"),"现行有效");assert.equal(Engine.implementationStatus(prior,"2026-10-01"),"已废止");
});

test("disabled rules cannot execute, even if their conditions match",()=>{
  const out=Engine.identify([synthetic],{},{rules:[{regulationId:synthetic.id,status:"disabled",includeAll:["生产经营单位"],includeAny:[],excludeAny:[],reviewWhen:[],applicability:"mandatory"}]});
  assert.equal(out.length,0);
});

test("evidence registration never claims compliance or counts missing indexes as provided",()=>{
  const record={matchedClauses:[{id:"A"},{id:"B"}]};
  assert.equal(Guidance.evidenceProgress(record,{A:{state:"provided",note:""},B:{state:"provided",note:" "}}).documented,0);
  const complete=Guidance.evidenceProgress(record,{A:{state:"provided",note:"台账A"},B:{state:"provided",note:"报告B"}});
  assert.equal(complete.documented,2);assert.match(complete.label,/非合规结论/);
});

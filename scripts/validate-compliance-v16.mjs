import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),G=require('../js/compliance-guidance.js'),E=require('../js/compliance-engine.js');
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const packs=['environment','safety'].map(n=>read(`data/compliance/${n}.v1.6.json`));
const base=[...read('data/compliance/laws.v1.json').records,...read('data/compliance/candidates.v1.json').records],baseRules=new Map(read('data/compliance/rules.v1.json').rules.map(r=>[r.regulationId,r]));
for(const r of read('data/compliance/scope-corrections.v1.6.json').rules){assert.ok(baseRules.has(r.regulationId),r.regulationId);baseRules.set(r.regulationId,{...baseRules.get(r.regulationId),...r});}
const clauseIds=new Set();
const official=url=>{const u=new URL(url);assert.equal(u.protocol,'https:');assert.ok(u.hostname.endsWith('.gov.cn'),url);assert.ok(u.pathname.length>2,'Official link must not just be a homepage');};
for(const pack of packs)for(const r of pack.records){
  assert.match(r.id,/^[-A-Z0-9_]+$/);assert.ok(r.name);official(r.sourceUrl);
  if(r.complianceEnabled){
    for(const key of ['documentNo','publishDate','effectiveDate','lastVerifiedAt','scopeSummary'])assert.ok(r[key],`${r.id}: ${key}`);
    for(const key of ['includeAll','includeAny','excludeAny','reviewWhen'])assert.ok(Array.isArray(r.rule[key]),`${r.id}: ${key}`);
    assert.ok(r.rule.includeAll.length||r.rule.includeAny.length||r.rule.reviewWhen.length,`${r.id} has no scope trigger`);
  }
  for(const c of r.clauses||[]){assert.ok(!clauseIds.has(c.id),`Duplicate clause ${c.id}`);clauseIds.add(c.id);for(const key of ['reference','summary','action'])assert.ok(c[key],`${c.id}: ${key}`);assert.ok(Array.isArray(c.whenAny)&&Array.isArray(c.whenAll)&&Array.isArray(c.evidence)&&c.evidence.length);official(c.sourceUrl);}
}
const merged=G.mergeCatalog(base,[...baseRules.values()],packs),active=merged.records.filter(r=>r.complianceEnabled&&E.implementationStatus(r,'2026-09-11')!=='已废止');
assert.equal(new Set(active.map(r=>r.id)).size,active.length);
const normalized=r=>r.name.replace(/中华人民共和国|\s|（|）|\(|\)/g,'');
assert.equal(new Set(active.map(normalized)).size,active.length,'Active duplicate titles');
assert.ok(!active.some(r=>r.name==='中华人民共和国环境保护法实施条例'));
assert.ok(active.some(r=>r.id==='REG-ENV-CODE-2026'));
assert.ok(!active.some(r=>['REG-002','REG-061','REG-062','REG-063','REG-064','REG-065','REG-066','REG-068'].includes(r.id)));
const profile={province:'山东省',city:'淄博市',enterpriseTypes:['危险化学品使用企业'],industries:['化学原料和化学制品制造'],riskTags:['涉及特殊作业','存在职业病危害','产生废水','产生废气','产生工业噪声'],hazardousActivities:['危化品使用','危化品储存'],hazardousWasteActivities:['危废产生','危废暂存'],environmentalActivities:['排放工业废水','废水间接排放','排放VOCs','产生一般工业固体废物'],regulatoryAttributes:['排污许可重点管理'],specialEquipmentTypes:['压力容器'],industryAttributes:['化工属性']};
const results=E.identify(merged.records,profile,{rules:merged.rules,today:'2026-09-11'});
console.log(JSON.stringify({status:'PASS',activeRecords:active.length,verifiedActive:active.filter(r=>r.verificationStatus==='已核验').length,structuredClauses:clauseIds.size,sample:{total:results.length,clear:results.filter(r=>r.applicability==='明确适用').length,conditional:results.filter(r=>r.applicability==='条件适用').length,review:results.filter(r=>r.applicability==='建议复核').length,clauses:results.reduce((n,r)=>n+r.matchedClauses.length,0)}}));

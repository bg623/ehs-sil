import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>JSON.parse(fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8"));
const formal=read("data/compliance/laws.v1.json").records;
const candidates=read("data/compliance/candidates.v1.json").records;
const rules=read("data/compliance/rules.v1.json").rules;
const legacy=read("data/regulations.json").regulations;
const directOfficial=/^https:\/\/(flk\.npc\.gov\.cn\/detail|openstd\.samr\.gov\.cn\/bzgk\/(?:std|gb)\/newGbInfo|std\.samr\.gov\.cn\/gb\/search\/gbDetailed|www\.mem\.gov\.cn\/.+\/t\d+_|www\.sd\.gov\.cn\/jpaas-jpolicy|www\.nhc\.gov\.cn\/(?:wjw\/pyl|fzs\/c100048)\/)/;
const normalize=s=>String(s||"").toUpperCase().replace(/[—–－]/g,"-").replace(/\s+/g,"");

for(const r of formal){
  for(const key of ["id","name","documentNo","type","status","publishDate","effectiveDate","issuingAuthority","sourceUrl","reviewer","lastVerifiedAt"])assert.ok(r[key],`${r.id} missing ${key}`);
  assert.equal(r.verificationStatus,"已核验",`${r.id} is not verified`);
  assert.match(r.sourceUrl,directOfficial,`${r.id} source must be a direct official detail page`);
}
assert.equal(new Set(formal.map(r=>normalize(r.documentNo))).size,formal.length,"formal standards contain duplicate document numbers");
assert.ok(candidates.every(r=>r.verificationStatus!=="已核验"),"candidate record cannot be marked verified");
assert.equal(new Set([...formal,...candidates].map(r=>r.id)).size,formal.length+candidates.length,"formal and candidate IDs overlap");
const recordIds=new Set([...formal,...candidates].map(r=>r.id));
for(const rule of rules){
  for(const key of ["ruleId","regulationId","version","status","applicability","explanationTemplate"])assert.ok(rule[key],`${rule.ruleId||"rule"} missing ${key}`);
  for(const key of ["includeAll","includeAny","excludeAny","reviewWhen"])assert.ok(Array.isArray(rule[key]),`${rule.ruleId} ${key} must be an array`);
  assert.ok(recordIds.has(rule.regulationId),`${rule.ruleId} references unknown regulation`);
  if(rule.status==="active")assert.ok(rule.includeAll.length||rule.includeAny.length||rule.reviewWhen.length,`${rule.ruleId} active rule has no match or review condition`);
}
for(const id of ["REG-018","REG-020","REG-023","REG-051"]){const r=legacy.find(x=>x.id===id);assert.ok(r,`${id} missing`);assert.equal(r.complianceEnabled,false,`${id} replacement must not be enabled`);assert.equal(r.status,"已废止",`${id} replacement status must be 已废止`);}
console.log(JSON.stringify({status:"PASS",formal:formal.length,candidates:candidates.length,rules:rules.length,replacedDisabled:4}));

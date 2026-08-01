import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>JSON.parse(fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8"));
const code=fs.readFileSync(new URL("../js/compliance-engine.js",import.meta.url),"utf8");
const sandbox={Intl,Date,console};sandbox.globalThis=sandbox;vm.runInNewContext(code,sandbox);
const E=sandbox.EHSComplianceEngine,formal=read("data/compliance/laws.v1.json").records,candidates=read("data/compliance/candidates.v1.json").records,rules=read("data/compliance/rules.v1.json").rules,cases=read("tests/fixtures/compliance-regression-cases.json");
const regulations=[...formal,...candidates];
for(const c of cases){
  const results=E.identify(regulations,c.profile,{rules,today:"2026-08-01"});
  for(const no of c.mustIncludeDocumentNos||[])assert.ok(results.some(r=>r.documentNo===no),`${c.id}: expected ${no}`);
  for(const no of c.mustExcludeDocumentNos||[])assert.ok(!results.some(r=>r.documentNo===no),`${c.id}: did not expect ${no}`);
  for(const text of c.mustExcludeNameFragments||[])assert.ok(!results.some(r=>r.name.includes(text)),`${c.id}: did not expect ${text}`);
  if(c.mustExcludeLocal)assert.ok(!results.some(r=>r.applicabilityType==="地方要求"),`${c.id}: local regulation leaked across province`);
  assert.ok(results.filter(r=>r.verificationStatus!=="已核验").every(r=>r.applicability==="建议复核"),`${c.id}: candidate was presented as a formal conclusion`);
}
const sd=E.identify(regulations,{province:"山东省",city:"淄博市",enterpriseTypes:["机械制造企业"],industries:["通用设备制造"]},{rules,today:"2026-08-01"});
const js=E.identify(regulations,{province:"江苏省",city:"苏州市",enterpriseTypes:["机械制造企业"],industries:["通用设备制造"]},{rules,today:"2026-08-01"});
assert.ok(sd.some(r=>r.applicabilityType==="地方要求"));assert.ok(!js.some(r=>r.applicabilityType==="地方要求"));
console.log(JSON.stringify({status:"PASS",cases:cases.length,shandong:sd.length,jiangsu:js.length}));

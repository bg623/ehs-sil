import assert from "node:assert/strict";import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8"));
const formal=read("data/compliance/laws.v1.json").records,candidates=read("data/compliance/candidates.v1.json").records,rules=read("data/compliance/rules.v1.json").rules;
assert.ok(formal.length>=6);assert.ok(candidates.length>=50);assert.equal(rules.length,formal.length+candidates.length);
for(const r of formal){for(const k of ["id","name","documentNo","issuingAuthority","status","sourceUrl","sourceName","sourceType","applicabilityType","verificationStatus","reviewer"])assert.ok(r[k],`${r.id} missing ${k}`);assert.equal(r.verificationStatus,"已核验");assert.match(r.lastVerifiedAt,/^\d{4}-\d{2}-\d{2}$/);}
assert.ok(candidates.every(r=>r.verificationStatus==="待复核"));
const updates=read("data/regulation-updates.json");assert.equal(updates.publicationPolicy,"candidate_requires_human_approval");assert.ok(updates.candidates.every(x=>x.humanConfirmed===false));
const html=fs.readFileSync(new URL("../tools/compliance-identification.html",import.meta.url),"utf8");assert.match(html,/不构成法律意见/);assert.match(html,/建议复核/);assert.match(html,/databaseCount/);assert.match(html,/application\/ld\+json/);assert.match(html,/导出项目/);assert.match(html,/compliance-workflow\.js/);assert.match(html,/compliance-export\.js/);assert.match(fs.readFileSync(new URL("../tools/regulations.html",import.meta.url),"utf8"),/立即进行智能识别/);
console.log(JSON.stringify({status:"PASS",formal:formal.length,candidates:candidates.length,rules:rules.length}));

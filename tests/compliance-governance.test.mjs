import assert from "node:assert/strict";import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8"));const d=read("data/regulations.json"),enabled=d.regulations.filter(r=>r.complianceEnabled);
assert.ok(enabled.length>=50);assert.equal(new Set(d.regulations.map(r=>r.id)).size,d.regulations.length);
for(const r of enabled){for(const k of ["id","name","documentNo","issuingAuthority","status","sourceUrl","sourceName","sourceType","applicabilityType","verificationStatus"])assert.ok(r[k],`${r.id} missing ${k}`);assert.match(r.sourceUrl,/^https:\/\//);assert.ok(["已核验","待复核"].includes(r.verificationStatus));if(r.verificationStatus==="已核验")assert.match(r.lastVerifiedAt,/^\d{4}-\d{2}-\d{2}$/);}
const updates=read("data/regulation-updates.json");assert.equal(updates.publicationPolicy,"candidate_requires_human_approval");assert.ok(updates.candidates.every(x=>x.humanConfirmed===false));
const html=fs.readFileSync(new URL("../tools/compliance-identification.html",import.meta.url),"utf8");assert.match(html,/不构成法律意见/);assert.match(html,/Excel/);assert.match(html,/application\/ld\+json/);assert.match(fs.readFileSync(new URL("../tools/regulations.html",import.meta.url),"utf8"),/立即进行智能识别/);
console.log(JSON.stringify({status:"PASS",enabled:enabled.length,verified:enabled.filter(r=>r.verificationStatus==="已核验").length}));

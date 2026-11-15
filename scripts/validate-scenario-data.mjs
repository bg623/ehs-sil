import fs from 'node:fs';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),read=f=>JSON.parse(fs.readFileSync(root+f,'utf8'));
const cap=read('data/scenario/capabilities.json'),reg=read('data/scenario/model-registry.json'),data=read('data/scenario/scenarios.json'),chem=read('data/scenario/chemicals.json');
for(const x of [reg,data,chem,read('data/scenario/source-manifest.json')])assert.equal(x.dataVersion,cap.dataVersion);
assert.equal(cap.releaseKind,'teaching');assert.equal(cap.screeningEnabled,false);assert.equal(cap.frequencyModel,false);assert.deepEqual(cap.approvedChemicalIds,[]);assert.deepEqual(chem.approvedScreeningMaterials,[]);
assert.equal(new Set(data.scenarios.map(s=>s.id)).size,6);assert.equal(data.stages.length,6);
for(const m of reg.models){assert.equal(m.technicalReview,null);assert.notEqual(m.allowedUse,'screening');}
const tools=read('data/tools.json');assert.equal(tools.total,tools.tools.length);assert.equal(tools.tools.filter(t=>t.path==='tools/scenario-workbench.html').length,1);
console.log('PASS scenario data versions, teaching-only gate, six mechanisms and real index total');

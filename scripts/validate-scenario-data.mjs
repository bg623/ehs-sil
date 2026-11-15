import fs from 'node:fs';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {APP_VERSION,DATA_VERSION,SCHEMA_VERSION} from '../js/scenario/version.mjs';import {createPreset} from '../js/scenario/presets.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=f=>JSON.parse(fs.readFileSync(root+f,'utf8'));
const c=Object.fromEntries(Object.entries({capabilities:'capabilities',chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios',sources:'source-manifest',registry:'model-registry'}).map(([k,f])=>[k,read('data/scenario/'+f+'.json')]));
for(const[k,value]of Object.entries(c))if(k!=='registry')assert.equal(value.dataVersion,DATA_VERSION,k);
assert.equal(c.capabilities.appVersion,APP_VERSION);assert.equal(c.capabilities.screeningEnabled,false);assert.equal(c.capabilities.releaseKind,'teaching');assert.equal(c.capabilities.frequencyModel,false);assert.deepEqual(c.capabilities.approvedChemicalIds,[]);assert.deepEqual(c.chemicals.approvedScreeningMaterials,[]);
assert.equal(read('build/scenario/package.json').version,APP_VERSION);assert.equal(read('build/scenario/package-lock.json').version,APP_VERSION);
assert.equal(c.scenarios.scenarios.length,6);for(const d of c.scenarios.scenarios)assert.ok(d.stages.length>0);
const sources=new Set(c.sources.sources.map(s=>s.id));for(const collection of [c.chemicals.materials,c.equipment.equipment,c.presets.presets,c.visualProfiles.profiles])for(const item of collection)for(const ref of item.sourceRefs||[])assert.ok(sources.has(ref),ref);
for(const m of c.chemicals.materials)assert.deepEqual(m.properties,{});
assert.ok(c.chemicals.materials.filter(m=>m.cas).length>=2);for(const p of c.presets.presets)assert.equal(createPreset(c,p.presetId).meta.schemaVersion,SCHEMA_VERSION);
for(const model of c.registry.models){assert.equal(model.technicalReview,null);assert.notEqual(model.allowedUse,'screening');}
assert.equal(createHash('sha256').update(fs.readFileSync(root+'js/scenario/models/pool-fire.mjs')).digest('hex'),'80a86d1ea1b8415dfc0321100b1833aab1a1eaf999fb16513cbbd49ccbd473dc');
const html=fs.readFileSync(root+'tools/scenario-workbench.html','utf8');assert.ok(html.includes(`data-scenario-app-version="${APP_VERSION}"`));assert.ok(html.includes(`/v${APP_VERSION}/app.mjs`));assert.ok(!html.includes('/v0.1.0/'));
const tools=read('data/tools.json');assert.equal(tools.total,tools.tools.length);assert.equal(tools.tools.filter(t=>t.path==='tools/scenario-workbench.html').length,1);
console.log('PASS teaching catalogs, sources, versions, all presets, immutable numerical algorithm and closed capability gate');

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createPreset,deriveQuantity} from '../js/scenario/presets.mjs';
import {buildSceneSpec,sampleStoryboard} from '../js/scenario/scene-spec.mjs';
import {previewChange,applyChange} from '../js/scenario/controller.mjs';
import {parseProjectText,clone,inputHash,APP_VERSION,DATA_VERSION} from '../js/scenario/schema.mjs';
import {assess,freezeA,compare} from '../js/scenario/engine.mjs';
import {makeNoiseVolume,NOISE_SIZE,NOISE_SEED} from '../js/scenario/rendering/noise-data.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const c=Object.fromEntries(Object.entries({chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios',capabilities:'capabilities',registry:'model-registry',sources:'source-manifest'}).map(([k,f])=>[k,read('../data/scenario/'+f+'.json')]));
const cases=[
 ['methanol-atmospheric-tank-pool-fire','pool-fire','tank','methanol'],
 ['n-heptane-atmospheric-tank-pool-fire','pool-fire','tank','n-heptane'],
 ['propane-gas-pipeline-jet-fire','jet-fire','pipe-rack','propane'],
 ['propane-gas-pipeline-flash-fire','flash-fire','pipe-rack','propane'],
 ['propane-gas-pipeline-vce','vapor-cloud-explosion','pipe-rack','propane'],
 ['propane-cabinet-confined-deflagration','confined-deflagration','cabinet','propane'],
];
test('R01 six explicit presets provide five distinct volumetric processes without engineering approval',()=>{
 assert.equal(APP_VERSION,'0.2.1');assert.equal(DATA_VERSION,'scenario-data-0.2.0');
 for(const [id,kind,geometry,material] of cases){const p=createPreset(c,id),s=buildSceneSpec(p,c);assert.equal(s.process.kind,kind);assert.equal(s.process.geometryKind,geometry);assert.equal(s.material.id,material);assert.equal(s.support.canPlayDetailedStoryboard,true,id);assert.equal(s.support.canCalculate,false);assert.equal(s.stages.length,6);assert.ok(s.process.visualValidity.note);}
});
test('R01/R18 gas-pipeline demos explicitly use gas and recorded mass, not liquefied tank fill',()=>{
 for(const [id,,geometry]of cases.filter(x=>x[2]!=='tank')){const p=createPreset(c,id),q=deriveQuantity(p);assert.equal(p.inputs.material.state,'gas');assert.equal(p.inputs.storage.quantityBasis,'mass');assert.equal(p.inputs.storage.volumeM3,null);assert.equal(p.inputs.storage.fillFraction,null);assert.equal(q.capacityM3,null);assert.equal(q.liquidLevelM,null);assert.equal(q.volumeM3,null);assert.ok(p.inputs.storage.inventoryKg>0);}
});
test('R01 ordinary accident replacement preserves atmospheric methanol and offers a compatible preset',()=>{
 const p=createPreset(c);for(const id of ['jet-fire','flash-fire','vce','confined-deflagration']){const next=applyChange(p,{type:'scenario',id},c).project,s=buildSceneSpec(next,c);assert.deepEqual(next.inputs.material,p.inputs.material);assert.deepEqual(next.inputs.equipment,p.inputs.equipment);assert.deepEqual(next.inputs.storage,p.inputs.storage);assert.equal(s.support.canPlayDetailedStoryboard,false);assert.ok(s.support.suggestedPresetId);assert.ok(s.support.issues.length);}
});
test('R07 jet direction is rooted in the nozzle and not a rotated pool field',()=>{
 const s=buildSceneSpec(createPreset(c,'propane-gas-pipeline-jet-fire'),c);assert.deepEqual(s.process.nozzle.position,s.equipment.anchors.leak);assert.equal(s.equipment.anchors.poolCenter,null);assert.ok(Math.abs(Math.hypot(...Object.values(s.process.nozzle.direction))-1)<1e-12);assert.equal(s.process.liquid,null);const jet=fs.readFileSync(new URL('../js/scenario/effects/jet-fire.mjs',import.meta.url),'utf8');assert.match(jet,/axial|centerline/);assert.ok(!jet.includes('poolFire('));
});
test('R08 flash has a moving combustion front and never a pressure pulse',()=>{
 const s=buildSceneSpec(createPreset(c,'propane-gas-pipeline-flash-fire'),c),a=sampleStoryboard(s,.52),b=sampleStoryboard(s,.7);assert.ok(b.combustionProgress>a.combustionProgress);assert.ok(a.cloudGrowth>0);for(const p of [.2,.5,.7,.9]){const f=sampleStoryboard(s,p);assert.equal(f.pressureProgress,null);assert.equal(f.pressurePulse,0);assert.equal(f.ventIntensity,0);}
});
test('R09 VCE preserves legacy vce ID, has obstruction geometry and separate optional pressure progress',()=>{
 const p=createPreset(c,'propane-gas-pipeline-vce'),s=buildSceneSpec(p,c);assert.equal(p.inputs.scenario.id,'vce');assert.equal(s.process.kind,'vapor-cloud-explosion');assert.equal(s.process.congestion,true);assert.equal(p.ui.pressureAux,false);assert.equal(sampleStoryboard(s,.4).fireIntensity,0);assert.ok(sampleStoryboard(s,.74).pressureProgress>0);assert.ok(sampleStoryboard(s,.68).fireIntensity>0);
});
test('R10 confined event has explicit enclosure and opening, independent internal/vent timing',()=>{
 const s=buildSceneSpec(createPreset(c,'propane-cabinet-confined-deflagration'),c),e=s.process.enclosure;assert.ok(e);assert.equal(e.opening.center.y,e.min.y);assert.ok(e.opening.widthM>0&&e.opening.heightM>0);const a=sampleStoryboard(s,.52),b=sampleStoryboard(s,.78);assert.ok(a.internalFire>0);assert.equal(a.ventIntensity,0);assert.ok(b.ventIntensity>0);assert.ok(b.ventOpening>0);assert.equal(s.process.geometryKind,'cabinet');
});
test('R12 all five timelines are deterministic and seek backwards without history',()=>{
 for(const [id]of cases){const s=buildSceneSpec(createPreset(c,id),c),first=sampleStoryboard(s,.68,17);sampleStoryboard(s,.93,17);assert.deepEqual(sampleStoryboard(s,.68,17),first);assert.equal(sampleStoryboard(s,0,17).fireVisible,false);for(const v of Object.values(first).filter(x=>typeof x==='number'))assert.ok(Number.isFinite(v));}
});
test('R04 feed ending leaves a retained liquid pool instead of deleting both at once',()=>{
 const s=buildSceneSpec(createPreset(c),c),a=sampleStoryboard(s,.6),b=sampleStoryboard(s,.97);assert.ok(a.releaseIntensity>0);assert.equal(b.releaseIntensity,0);assert.ok(b.poolRetention>.8);assert.ok(b.poolVisible);
});
test('R11/R18 material properties remain empty and every public numerical output stays null',async()=>{
 assert.equal(c.capabilities.screeningEnabled,false);assert.deepEqual(c.capabilities.approvedChemicalIds,[]);for(const m of c.chemicals.materials)assert.deepEqual(m.properties,{});for(const [id]of cases){const p=createPreset(c,id),d=c.scenarios.scenarios.find(x=>x.id===p.inputs.scenario.id),r=await assess(p,d);for(const output of Object.values(r.outputs)){assert.equal(output.value,null);assert.equal(output.status,'not_evaluated');}assert.equal(r.model.version,'0.1.0');}for(const m of c.registry.models){assert.equal(m.technicalReview,null);assert.equal(m.allowedUse,'teaching');}
});
test('R17 actual V0.1.1 fixture opens with independent frozen A and new UI defaults',()=>{
 const original=read('./fixtures/scenario-v011-project.json'),before=JSON.stringify(original),p=parseProjectText(before);assert.deepEqual(p.inputs.material,original.inputs.material);assert.deepEqual(p.inputs.storage,original.inputs.storage);assert.ok(p.comparison);assert.equal(p.comparison.project.inputs.material.id,original.comparison.project.inputs.material.id);assert.equal(p.ui.quality,'balanced');assert.equal(p.ui.pressureAux,false);assert.equal(p.ui.cutaway,false);assert.equal(JSON.stringify(original),before);assert.equal(compare(p.comparison,p).numericalComparable,false);
});
test('R18 frozen V0.1.1 A remains condition-comparable after the visual upgrade',async()=>{
 const p=createPreset(c),r=await assess(p,c.scenarios.scenarios.find(x=>x.id==='pool-fire'));p.comparison=freezeA(p,r);p.comparison.dataVersion='scenario-data-0.1.1';const q=applyChange(p,{type:'material',id:'ethanol'},c).project,comparison=compare(q.comparison,q);assert.equal(comparison.compatible,true);assert.equal(comparison.numericalComparable,false);assert.equal(q.comparison.project.inputs.material.id,'methanol');
});
test('R18 all visual preferences do not alter input hash or manufacture a revision',async()=>{
 const p=createPreset(c),before=await inputHash(p),revision=p.inputRevision;for(const quality of ['low','balanced','high']){p.ui.quality=quality;p.ui.cutaway=true;p.ui.pressureAux=true;p.ui.labelDetail=true;p.ui.visualMode='natural';assert.equal(await inputHash(p),before);assert.equal(p.inputRevision,revision);}
});
test('R13 preview stays pure and 20 scene/preset changes preserve independently frozen A',async()=>{
 let p=createPreset(c);p.comparison=freezeA(p,await assess(p,c.scenarios.scenarios.find(x=>x.id==='pool-fire')));const a=clone(p.comparison);for(let i=0;i<20;i++){const id=cases[i%cases.length][0],before=JSON.stringify(p);previewChange(p,{type:'preset',id},c);assert.equal(JSON.stringify(p),before);p=applyChange(p,{type:'preset',id},c).project;assert.deepEqual(p.comparison,a);assert.equal(buildSceneSpec(p,c).process.kind,cases[i%cases.length][1]);}
});
test('R21 deterministic volume texture is true 3D R8 with bounded decoded memory',()=>{
 const a=makeNoiseVolume(),b=makeNoiseVolume();assert.equal(NOISE_SIZE,64);assert.equal(a.byteLength,262144);assert.deepEqual(a,b);assert.notEqual(createHash('sha256').update(a).digest('hex'),createHash('sha256').update(makeNoiseVolume(64,NOISE_SEED+1)).digest('hex'));assert.throws(()=>makeNoiseVolume(256));
});
test('R03/R14 renderer contains depth termination and one compositing lifecycle, no private RAF',()=>{
 const file=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8'),renderer=file('../js/scenario/rendering/volume-renderer.mjs'),view=file('../js/scenario/view-3d.mjs');assert.match(renderer,/DepthTexture/);assert.match(renderer,/opaqueWorld/);assert.match(renderer,/exp\(-/);assert.match(renderer,/sceneTarget\.dispose/);assert.ok(!view.includes('requestAnimationFrame('));assert.ok(!renderer.includes('requestAnimationFrame('));
});

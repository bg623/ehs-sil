import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {APP_VERSION, SCHEMA_VERSION, DATA_VERSION, MODEL_VERSION, clone, newProject, parseProjectText, validateProject, inputHash} from '../js/scenario/schema.mjs';
import {migrateProject} from '../js/scenario/migrations.mjs';
import {createPreset} from '../js/scenario/presets.mjs';
import {previewChange, applyChange, undoLastChange} from '../js/scenario/controller.mjs';
import {checkCompatibility} from '../js/scenario/compatibility.mjs';
import {buildSceneSpec, sampleStoryboard} from '../js/scenario/scene-spec.mjs';
import {assess, acceptsResult, freezeA, compare} from '../js/scenario/engine.mjs';
import {load, save, clear, STORAGE_KEY} from '../js/scenario/storage.mjs';
import {report, csv} from '../js/scenario/export.mjs';

const read = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const catalogs = {
  chemicals: read('../data/scenario/chemicals.json'),
  equipment: read('../data/scenario/equipment.json'),
  presets: read('../data/scenario/presets.json'),
  visualProfiles: read('../data/scenario/visual-profiles.json'),
  scenarios: read('../data/scenario/scenarios.json'),
  capabilities: read('../data/scenario/capabilities.json'),
  registry: read('../data/scenario/model-registry.json'),
  sources: read('../data/scenario/source-manifest.json'),
};
const preset = () => createPreset(catalogs, 'methanol-atmospheric-tank-pool-fire');
const definition = p => catalogs.scenarios.scenarios.find(s => s.id === p.inputs.scenario.id);
const changed = (p, type, extra={}) => applyChange(p, {type, ...extra}, catalogs).project;
const legacy = () => read('./fixtures/scenario-v1-project.json');
const memoryStorage = initial => {
  const records = new Map(initial || []);
  return {records, getItem: k => records.get(k) ?? null, setItem: (k, v) => records.set(k, v), removeItem: k => records.delete(k)};
};

test('UX01/02 default methanol preset is complete and quantity is volume, not fabricated mass', () => {
  const p = preset();
  assert.equal(APP_VERSION, '0.1.1');
  assert.equal(SCHEMA_VERSION, '1.1.0');
  assert.equal(DATA_VERSION, 'scenario-data-0.1.1');
  assert.equal(MODEL_VERSION, '0.1.0');
  assert.equal(p.inputs.material.id, 'methanol');
  assert.equal(p.inputs.material.cas, '67-56-1');
  assert.equal(p.inputs.storage.quantityBasis, 'volume');
  assert.equal(p.inputs.storage.volumeM3, 30);
  assert.equal(p.inputs.storage.inventoryKg, null);
  assert.equal(p.inputs.storage.fillFraction, null);
  assert.equal(p.inputs.material.temperatureK, 293.15);
  assert.equal(p.inputs.storage.pressurePa, 101325);
  assert.equal(p.inputs.equipment.geometry.diameterM, 4);
  assert.equal(p.inputs.equipment.geometry.heightM, 4);
  assert.equal(p.inputs.equipment.containment.lengthM, 12);
  assert.equal(p.inputs.equipment.containment.widthM, 10);
  assert.equal(p.inputs.scenario.id, 'pool-fire');
  assert.ok(p.meta.presetId && p.meta.presetVersion);
  assert.doesNotThrow(() => validateProject(p));
  const spec = buildSceneSpec(p, catalogs);
  assert.ok(Math.abs(spec.equipment.liquidLevelM - 2.3873241463784303) < 1e-10);
  assert.equal(spec.pool.radiusM, 1.2);
});

test('UX03/09 change preview is pure, material apply preserves compatible fields and advances once', async () => {
  const p = preset();
  p.comparison = freezeA(p, await assess(p, definition(p)));
  const before = JSON.stringify(p);
  const preview = previewChange(p, {type:'material', id:'ethanol'}, catalogs);
  assert.equal(JSON.stringify(p), before, 'preview/cancel must not change inputs, A or revision');
  assert.equal(preview.project.inputs.material.id, 'ethanol');
  const next = changed(p, 'material', {id:'ethanol'});
  assert.equal(next.inputRevision, p.inputRevision + 1);
  assert.equal(next.inputs.storage.volumeM3, 30);
  assert.equal(next.inputs.storage.inventoryKg, null);
  assert.deepEqual(next.inputs.equipment, p.inputs.equipment);
  assert.equal(next.inputs.material.temperatureK, p.inputs.material.temperatureK);
  assert.equal(next.inputs.storage.pressurePa, p.inputs.storage.pressurePa);
  assert.equal(next.inputs.scenario.id, 'pool-fire');
  assert.deepEqual(next.comparison, p.comparison);
  assert.notEqual(next.inputs.material.visualProfileRef, p.inputs.material.visualProfileRef);
  const back = undoLastChange(next, p);
  assert.equal(back.inputs.material.id, 'methanol');
  assert.equal(back.inputRevision, next.inputRevision + 1);
  assert.deepEqual(back.comparison, p.comparison);
  assert.equal(JSON.stringify(p), before);
});

test('UX04 mass basis preserves mass through a material swap and does not invent density', () => {
  const p = changed(preset(), 'storage', {patch:{quantityBasis:'mass', quantityValue:20000}});
  const next = changed(p, 'material', {id:'ethanol'});
  assert.equal(next.inputs.storage.quantityBasis, 'mass');
  assert.equal(next.inputs.storage.inventoryKg, 20000);
  assert.equal(next.inputs.storage.volumeM3, null);
  assert.equal(next.inputs.storage.fillFraction, null);
  assert.equal(buildSceneSpec(next, catalogs).equipment.liquidLevelM, null);
});

test('UX04/05 fill basis survives equipment replacement; conflicting quantity fields are rejected', () => {
  const p = changed(preset(), 'storage', {patch:{quantityBasis:'fill', quantityValue:0.6}});
  const other = catalogs.equipment.equipment.find(e => e.id !== p.inputs.equipment.id);
  assert.ok(other, 'at least two equipment choices');
  const next = changed(p, 'equipment', {id:other.id});
  assert.equal(next.inputs.material.id, 'methanol');
  assert.equal(next.inputs.storage.quantityBasis, 'fill');
  assert.equal(next.inputs.storage.fillFraction, 0.6);
  assert.equal(next.inputs.storage.inventoryKg, null);
  assert.equal(next.inputs.storage.volumeM3, null);
  if (other.geometry.orientation === 'vertical') assert.ok(Math.abs(buildSceneSpec(next,catalogs).equipment.liquidLevelM - other.geometry.heightM*0.6)<1e-12);
  const corrupt = clone(next);
  corrupt.inputs.storage.inventoryKg = 100;
  assert.throws(() => validateProject(corrupt));
});

test('quantity basis change alone must not relabel an old volume as the same numeric mass', () => {
  const p=preset();
  let next;
  try {
    next=changed(p,'storage',{patch:{quantityBasis:'mass'}});
  } catch(error) {
    assert.match(error.message,/基准|数量|输入|库存/);
    assert.equal(p.inputs.storage.volumeM3,30);
    return;
  }
  assert.equal(next.inputs.storage.inventoryKg,null,'30 m³ is not 30 kg without a new explicit input');
  assert.equal(next.inputs.storage.volumeM3,null);
  assert.equal(p.inputs.storage.volumeM3,30);
});

test('a no-op application does not manufacture a new analysis revision', async () => {
  const p=preset(),hash=await inputHash(p);
  const next=changed(p,'material',{id:'methanol'});
  assert.equal(await inputHash(next),hash);
  assert.equal(next.inputRevision,p.inputRevision);
});

test('UX05 overcapacity is visible without silently clipping inventory or keeping impossible anchors', () => {
  const p = changed(preset(), 'storage', {patch:{quantityBasis:'volume', quantityValue:1000}});
  const support = checkCompatibility(p, catalogs);
  assert.equal(p.inputs.storage.volumeM3, 1000);
  assert.equal(support.canPlayDetailedStoryboard, false);
  assert.ok(support.issues.length);
});

test('UX06 unknown temperature and pressure remain null, absolute pressure never becomes zero by convention', () => {
  const p = changed(preset(), 'storage', {patch:{temperatureK:null, pressurePa:null, pressureMode:'unknown'}});
  assert.equal(p.inputs.material.temperatureK, null);
  assert.equal(p.inputs.storage.pressurePa, null);
  assert.doesNotThrow(() => validateProject(p));
});

test('UX07/08 BLEVE keeps methanol and atmospheric conditions, but has its own mechanism', () => {
  const p = preset();
  const next = changed(p, 'scenario', {id:'bleve'});
  assert.equal(next.inputs.material.id, 'methanol');
  assert.equal(next.inputs.storage.pressurePa, 101325);
  assert.equal(next.inputs.storage.volumeM3, 30);
  assert.deepEqual(next.inputs.equipment, p.inputs.equipment);
  const support = checkCompatibility(next, catalogs);
  assert.equal(support.canCalculate, false);
  assert.equal(support.canPlayDetailedStoryboard, false);
  assert.equal(support.support, 'mechanism_only');
  assert.ok(support.issues.length);
  const spec = buildSceneSpec(next, catalogs);
  assert.equal(spec.sceneId, 'bleve');
  assert.ok(spec.stages.every(s => !/液池|液池点火/.test(s.title)));
});

test('UX10 preset replacement keeps frozen A independent and caller can restore the full prior draft', async () => {
  const p = changed(preset(), 'material', {id:'ethanol'});
  p.comparison = freezeA(p, await assess(p, definition(p)));
  p.evidenceNotes = 'QA 旧草稿说明';
  const transaction = applyChange(p, {type:'preset', id:'methanol-atmospheric-tank-pool-fire'}, catalogs);
  assert.equal(transaction.project.inputs.material.id, 'methanol');
  assert.equal(transaction.previous.inputs.material.id, 'ethanol');
  assert.equal(transaction.previous.evidenceNotes, 'QA 旧草稿说明');
  assert.deepEqual(transaction.project.comparison, p.comparison);
  const restored = undoLastChange(transaction.project, transaction.previous);
  assert.equal(restored.inputs.material.id, 'ethanol');
  assert.equal(restored.evidenceNotes, 'QA 旧草稿说明');
});

test('ST01/02 input hashes ignore all display settings; material changes and undo reject old task IDs', async () => {
  const p = preset(), hash = await inputHash(p), revision = p.inputRevision;
  const result = await assess(p, definition(p), 'old-task');
  p.ui.camera = 'top'; p.ui.visualMode = 'natural'; p.ui.speed = 2; p.ui.stage = 4;
  assert.equal(await inputHash(p), hash);
  assert.equal(p.inputRevision, revision);
  const next = changed(p, 'material', {id:'ethanol'});
  assert.notEqual(await inputHash(next), hash);
  assert.equal(acceptsResult(result, 'old-task', next), false);
  const back = undoLastChange(next, p);
  assert.equal(acceptsResult(result, 'old-task', back), false);
  assert.throws(() => freezeA(next, result));
});

test('ST03 sequential material/scenario commands end at the last explicit command, without mutating A', async () => {
  let p = preset();
  p.comparison = freezeA(p, await assess(p, definition(p)));
  const a = clone(p.comparison), startRevision = p.inputRevision;
  for (let i = 0; i < 20; i++) p = changed(p, i % 2 ? 'scenario' : 'material', {id:i % 2 ? (i === 19 ? 'toxic' : 'vce') : (i % 4 ? 'methanol' : 'ethanol')});
  assert.equal(p.inputs.scenario.id, 'toxic');
  assert.deepEqual(p.comparison, a);
  assert.ok(p.inputRevision > startRevision);
  assert.ok(p.inputRevision <= startRevision + 20);
});

test('VI01/02/04 scene spec derives consistent anchors and deterministic frames without a result object', () => {
  const p = preset(), spec = buildSceneSpec(p, catalogs);
  const leak = spec.equipment.anchors.leak, pool = spec.equipment.anchors.poolCenter;
  assert.ok(leak && pool);
  assert.ok([leak.x,leak.y,leak.z,pool.x,pool.y,pool.z].every(Number.isFinite));
  assert.ok(Math.hypot(pool.x,pool.y) > p.inputs.equipment.geometry.diameterM/2, 'pool not inside tank foundation');
  assert.ok(Math.abs(pool.x)+spec.pool.radiusM <= p.inputs.equipment.containment.lengthM/2);
  assert.ok(Math.abs(pool.y)+spec.pool.radiusM <= p.inputs.equipment.containment.widthM/2);
  const before = JSON.stringify(p);
  assert.deepEqual(sampleStoryboard(spec,0.67,17), sampleStoryboard(spec,0.67,17));
  assert.equal(sampleStoryboard(spec,0,17).fireVisible, false);
  assert.equal(sampleStoryboard(spec,0.8,17).fireVisible, true);
  assert.equal(JSON.stringify(p), before);
});

test('VI03/05 mixture visuals do not claim confirmed pure-methanol appearance; non-pool types never borrow pool stages', () => {
  const p = preset();
  p.inputs.material.composition = 'mixture';
  const mixed = buildSceneSpec(p, catalogs);
  assert.ok(/通用|不确定|混合/.test(mixed.visual.note + ' ' + mixed.visual.profile.description));
  for (const id of ['jet-fire','flash-fire','vce','bleve','toxic']) {
    const spec = buildSceneSpec(changed(preset(), 'scenario', {id}), catalogs);
    assert.equal(spec.sceneId, id);
    assert.equal(spec.support.canPlayDetailedStoryboard, false);
    assert.ok(spec.stages.every(s => !/正常储存|形成液池|液池形成|液池点火/.test(s.title)));
  }
});

test('DA01 legacy migration preserves identity, quantity basis, evidence and independently frozen A without revision drift', () => {
  const raw = legacy(), before = JSON.stringify(raw), migrated = migrateProject(raw).project;
  assert.equal(JSON.stringify(raw), before);
  assert.equal(migrated.meta.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.inputRevision, 12);
  assert.equal(migrated.inputs.material.id, 'teaching-a');
  assert.equal(migrated.inputs.material.cas, null);
  assert.equal(migrated.inputs.storage.quantityBasis, 'mass');
  assert.equal(migrated.inputs.storage.inventoryKg, 1000);
  assert.equal(migrated.inputs.storage.volumeM3, null);
  assert.equal(migrated.inputs.storage.fillFraction, null);
  assert.equal(migrated.inputs.material.temperatureK, 311.15);
  assert.equal(migrated.inputs.storage.pressurePa, 187000);
  assert.equal(migrated.inputs.storage.equipment, '用户自定义旧储罐');
  assert.equal(migrated.inputs.equipment.id, 'generic');
  assert.equal(migrated.inputs.equipment.geometry.diameterM, null);
  assert.deepEqual(migrated.controls, raw.controls);
  assert.deepEqual(migrated.assumptions, raw.assumptions);
  assert.equal(migrated.evidenceNotes, raw.evidenceNotes);
  assert.equal(migrated.comparison.project.inputs.storage.inventoryKg, 750);
  assert.equal(migrated.comparison.project.inputs.material.temperatureK, 298.15);
  assert.equal(migrated.comparison.project.comparison, null);
  assert.equal(migrated.comparison.project.inputRevision, 4);
  assert.equal(migrated.comparison.dataVersion, 'scenario-data-0.1.0');
  assert.deepEqual(migrateProject(migrated).project, migrated, 'migration must be idempotent');
});

test('DA01/02 parsing and validation are pure; imported review/result claims never become trusted state', () => {
  const raw = legacy(); raw.result = {outputs:{thermalRadiation:{value:123}}};raw.reviewStatus='reviewed';
  raw.comparison.project.resultSummary={status:'screening_available'};
  const p = parseProjectText(JSON.stringify(raw)), before=JSON.stringify(p);
  assert.equal(p.inputRevision, raw.inputRevision);
  assert.equal(p.result, undefined); assert.equal(p.reviewStatus, undefined);
  assert.equal(p.comparison.project.resultSummary, undefined);
  validateProject(p);assert.equal(JSON.stringify(p), before);
  assert.deepEqual(parseProjectText(JSON.stringify(p)), p);
  for (const mutate of [x=>x.meta.schemaVersion='9.0.0', x=>x.inputs.material.approved=true, x=>x.inputs.storage.volumeM3='30']) {
    const bad=clone(p);mutate(bad);assert.throws(()=>parseProjectText(JSON.stringify(bad)));
  }
  assert.throws(()=>parseProjectText('{broken'));
  assert.throws(()=>parseProjectText('{"__proto__":{"screeningEnabled":true}}'));
  assert.throws(()=>parseProjectText(' '.repeat(1048577)));
});

test('DA02 raw migration never turns nonfinite numeric values into unknown null', () => {
  for(const value of [Infinity,-Infinity,NaN]) {
    const raw=legacy();raw.inputs.storage.inventoryKg=value;
    assert.throws(()=>migrateProject(raw));
    assert.equal(Number.isFinite(raw.inputs.storage.inventoryKg),false);
  }
});

test('DA03 new storage key migration preserves original bytes and other tool data, including when writes fail', () => {
  const raw=JSON.stringify(legacy()), v1='ehs-sil-scenario-project-v1';
  assert.equal(STORAGE_KEY, 'ehs-sil-scenario-project-v2');
  const s=memoryStorage([[v1,raw],['ehs-sil-moc-record-v1','sentinel']]);
  const first=load(s);
  assert.equal(first.project.inputs.storage.inventoryKg,1000);
  assert.equal(s.getItem(v1),raw);
  assert.ok(s.getItem(STORAGE_KEY));
  const stored=s.getItem(STORAGE_KEY),second=load(s);
  assert.equal(s.getItem(STORAGE_KEY),stored);
  assert.equal(second.project.inputRevision,12);
  clear(s);
  assert.equal(s.getItem(v1),raw);
  assert.equal(s.getItem('ehs-sil-moc-record-v1'),'sentinel');
  assert.equal(load(s).project,null,'a deliberate clear must not resurrect the preserved v1 draft');
  const denied={getItem:k=>k===v1?raw:null,setItem(){throw Error('quota')},removeItem(){throw Error('should not delete')}};
  const failed=load(denied);
  assert.ok(failed.error || failed.status==='failed');
  assert.equal(failed.project?.inputs.storage.inventoryKg,1000,'keep a recoverable in-memory migrated draft');
});

test('EX01/02 stale or missing results export current ethanol VCE, never an executed pool-fire model or old hash', async () => {
  const p=preset(),old=await assess(p,definition(p),'old');
  let next=changed(p,'material',{id:'ethanol'});next=changed(next,'scenario',{id:'vce'});
  for(const result of [null,old]){
    const html=report(next,result,catalogs),text=csv(next,result,catalogs);
    assert.match(html,/乙醇/);assert.match(html,/VCE|蒸气云爆炸/);
    assert.ok(!html.includes(old.inputHash));assert.ok(!text.includes(old.inputHash));
    assert.ok(!html.includes('pool-fire-teaching'),'stale report must not claim a pool-fire model ran');
    assert.match(html,/待检查|待重算|未评估/);
    assert.match(text,/volume|体积/);assert.match(text,/30/);
  }
});

test('EX03/04 comparison survives application/data patch differences and export preserves display-mode disclosure', async () => {
  const p=preset();p.comparison=freezeA(p,await assess(p,definition(p)));
  assert.equal(p.comparison.modelVersion,MODEL_VERSION);
  p.comparison.dataVersion='scenario-data-0.1.0';
  const next=changed(p,'material',{id:'ethanol'}),comparison=compare(next.comparison,next);
  assert.ok(comparison.differences.length);
  assert.equal(next.comparison.project.inputs.material.id,'methanol');
  next.ui.visualMode='natural';const natural=report(next,null,catalogs);
  assert.match(natural,/自然外观|外观示意/);assert.match(natural,/非实测|不是实测/);
  next.ui.visualMode='assisted';const assisted=report(next,null,catalogs);
  assert.match(assisted,/增强轮廓|可见性辅助/);assert.match(assisted,/不代表真实|非实测/);
});

test('GA01 numerical algorithms, review status and production engineering-material set remain unchanged', async () => {
  const algo=fs.readFileSync(new URL('../js/scenario/models/pool-fire.mjs',import.meta.url));
  assert.equal(createHash('sha256').update(algo).digest('hex'),'80a86d1ea1b8415dfc0321100b1833aab1a1eaf999fb16513cbbd49ccbd473dc');
  assert.equal(catalogs.capabilities.screeningEnabled,false);
  assert.deepEqual(catalogs.capabilities.approvedChemicalIds,[]);
  assert.deepEqual(catalogs.chemicals.approvedScreeningMaterials,[]);
  for(const model of catalogs.registry.models)assert.equal(model.technicalReview,null);
  for(const id of ['pool-fire','jet-fire','flash-fire','vce','bleve','toxic']){
    const p=changed(preset(),'scenario',{id}),result=await assess(p,definition(p));
    for(const output of Object.values(result.outputs)){assert.equal(output.value,null);assert.equal(output.status,'not_evaluated');}
    if(id!=='pool-fire')assert.notEqual(result.model.id,'pool-fire-teaching');
  }
});

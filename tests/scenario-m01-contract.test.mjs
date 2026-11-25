import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createPreset,bindEquipment,setQuantity} from '../js/scenario/presets.mjs';
import {buildSceneSpec,sampleStoryboard} from '../js/scenario/scene-spec.mjs';
import {shouldUseM01,deriveM01Layout,m01Progress} from '../js/scenario/kimi-m01/contract.mjs';
import {clone,inputHash,APP_VERSION,DATA_VERSION,SCHEMA_VERSION,MODEL_VERSION,parseProjectText} from '../js/scenario/schema.mjs';
import {assess,freezeA,compare} from '../js/scenario/engine.mjs';
import {applyChange} from '../js/scenario/controller.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
const files={chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios',capabilities:'capabilities',registry:'model-registry',sources:'source-manifest'};
const catalogs=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,read('../data/scenario/'+v+'.json')]));
const make=(id='methanol-atmospheric-tank-pool-fire')=>buildSceneSpec(createPreset(catalogs,id),catalogs);
const approx=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-10,`${message}: ${a} != ${b}`);

test('M01 narrow visual gate does not select other materials, phases, locations or processes',()=>{
  const base=make();assert.equal(shouldUseM01(base),true);assert.equal(base.visualAdapter,'kimi-m01');
  for(const id of ['ethanol-atmospheric-tank-pool-fire','n-heptane-atmospheric-tank-pool-fire','propane-gas-pipeline-jet-fire','propane-gas-pipeline-flash-fire','propane-gas-pipeline-vce','propane-cabinet-confined-deflagration']) {
    const spec=make(id);assert.equal(shouldUseM01(spec),false,id);assert.equal(spec.visualAdapter,'native',id);
  }
  for(const mutate of [s=>s.material.id='ethanol',s=>s.material.composition='mixture',s=>s.material.state='gas',s=>s.equipment.leakAnchor='tank-wall',s=>s.equipment.geometry.orientation='horizontal',s=>s.sceneId='jet-fire',s=>s.support.canPlayDetailedStoryboard=false]) {
    const spec=clone(base);mutate(spec);assert.equal(shouldUseM01(spec),false,mutate.toString());
  }
});

test('M01 stage clock is a deterministic monotone map of the existing six equal phases',()=>{
  const knots=[0,.12,.28,.46,.60,.86,1];
  for(let i=0;i<=6;i++)approx(m01Progress(i/6),knots[i],`stage ${i}`);
  let previous=-1;
  for(let i=0;i<=600;i++){const p=i/600,mapped=m01Progress(p);assert.ok(mapped>=previous&&mapped>=0&&mapped<=1);previous=mapped;assert.equal(m01Progress(p),mapped);}
  assert.equal(m01Progress(-10),0);assert.equal(m01Progress(10),1);
  const spec=make(),first=sampleStoryboard(spec,.68,17);sampleStoryboard(spec,.93,17);assert.deepEqual(sampleStoryboard(spec,.68,17),first);
});

test('M01 layout derives metre anchors and fits the visual pool without changing equipment or radius inputs',()=>{
  const equipment=clone(make().equipment),before=JSON.stringify(equipment),radius=1.2,layout=deriveM01Layout(equipment,radius);
  assert.equal(layout.valid,true);assert.equal(JSON.stringify(equipment),before);assert.deepEqual(layout.leak,layout.anchors.leak);assert.deepEqual(layout.poolCenter,layout.anchors.poolCenter);
  for(const point of Object.values(layout.anchors)){for(const axis of ['x','y','z'])assert.equal(Number.isFinite(point[axis]),true);}
  assert.ok(layout.leak.z>layout.poolCenter.z,'release point is above the ground');
  const {lengthM:L,widthM:W}=equipment.containment,margin=radius*1.12;
  assert.ok(Math.abs(layout.poolCenter.x)+margin<=L/2,'irregular pool fits the length');
  assert.ok(Math.abs(layout.poolCenter.y)+margin<=W/2,'irregular pool fits the width');
  assert.deepEqual(layout.scales.tank,[1,1,1]);assert.deepEqual(layout.scales.bund,[1,1,1]);
  for(const mutate of [e=>e.geometry.diameterM=NaN,e=>e.geometry.heightM=0,e=>e.containment.lengthM=-1,e=>e.containment.widthM=null]) {
    const invalid=clone(equipment);mutate(invalid);const result=deriveM01Layout(invalid,radius);assert.equal(result.valid,false);assert.ok(result.reason);
  }
});

test('M01 rejects narrow containment even when a small liquid pool itself would fit, without changing inputs',()=>{
  for(const [lengthM,widthM]of [[4,10],[12,4]]) {
    const p=createPreset(catalogs);p.inputs.equipment.containment.lengthM=lengthM;p.inputs.equipment.containment.widthM=widthM;p.inputs.pool.radiusM=.2;
    const before=JSON.stringify(p),layout=deriveM01Layout(p.inputs.equipment,.2);
    assert.equal(layout.valid,false,`${lengthM}×${widthM}`);assert.ok(layout.reason);
    const spec=buildSceneSpec(p,catalogs);assert.equal(spec.visualAdapter,'native');assert.equal(shouldUseM01(spec),false);
    // Also exercise the M01 geometry gate independently of the older mechanism
    // compatibility check, which already rejects one of these combinations.
    spec.support.canPlayDetailedStoryboard=true;assert.equal(shouldUseM01(spec),false);
    assert.equal(JSON.stringify(p),before,'do not widen containment, reduce the tank or alter the pool to force a visual fit');
  }
});

test('M01 default and explicitly compatible small-tank fixtures remain supported after device-envelope gating',()=>{
  const fixtures=[createPreset(catalogs),createPreset(catalogs)];
  bindEquipment(fixtures[1],'small-vertical-atmospheric',catalogs);
  setQuantity(fixtures[1],'volume',10); // Explicit test input, never an automatic stock correction.
  for(const p of fixtures) {
    const before=JSON.stringify(p),spec=buildSceneSpec(p,catalogs),layout=deriveM01Layout(spec.equipment,spec.pool.radiusM);
    assert.equal(spec.support.canPlayDetailedStoryboard,true);assert.equal(shouldUseM01(spec),true);assert.equal(spec.visualAdapter,'kimi-m01');assert.equal(layout.valid,true);
    assert.equal(JSON.stringify(p),before);
  }
});

test('M01 rejects a very low outlet instead of drawing liquid upward from below the pool surface',()=>{
  const p=createPreset(catalogs);p.inputs.equipment.geometry.heightM=.1;p.inputs.pool.radiusM=.2;setQuantity(p,'volume',.5);
  const before=JSON.stringify(p),spec=buildSceneSpec(p,catalogs),layout=deriveM01Layout(p.inputs.equipment,p.inputs.pool.radiusM);
  assert.equal(spec.support.canPlayDetailedStoryboard,true,'this is specifically an adapter geometry limit, not a pre-existing mechanism restriction');
  assert.equal(layout.valid,false);assert.match(layout.reason,/过低|向下液流|高度/);assert.equal(shouldUseM01(spec),false);assert.equal(spec.visualAdapter,'native');
  assert.equal(JSON.stringify(p),before,'height, stock and pool inputs are not silently adjusted');
});

test('M01 visual adaptation leaves input hashes, revision, A/B and old drafts unchanged',async()=>{
  let p=createPreset(catalogs),result=await assess(p,catalogs.scenarios.scenarios.find(s=>s.id==='pool-fire'));
  p.comparison=freezeA(p,result);const frozen=clone(p.comparison),hash=await inputHash(p),before=JSON.stringify(p);
  const spec=buildSceneSpec(p,catalogs);deriveM01Layout(spec.equipment,spec.pool.radiusM);
  for(const progress of [0,.2,.7,1,.1])sampleStoryboard(spec,progress,17);
  assert.equal(JSON.stringify(p),before);assert.equal(await inputHash(p),hash);assert.deepEqual(p.comparison,frozen);
  p=applyChange(p,{type:'material',id:'ethanol'},catalogs).project;assert.deepEqual(p.comparison,frozen);assert.equal(compare(p.comparison,p).numericalComparable,false);
  const raw=fs.readFileSync(new URL('./fixtures/scenario-v011-project.json',import.meta.url),'utf8'),old=parseProjectText(raw);
  assert.ok(old.comparison);assert.deepEqual(old.inputs.material,JSON.parse(raw).inputs.material);assert.deepEqual(old.inputs.storage,JSON.parse(raw).inputs.storage);
});

test('M01 release changes application visuals only, not math, schema, physics properties or review gates',async()=>{
  assert.equal(APP_VERSION,'0.2.1');assert.equal(DATA_VERSION,'scenario-data-0.2.0');assert.equal(SCHEMA_VERSION,'1.1.0');assert.equal(MODEL_VERSION,'0.1.0');
  const baselines={
    '../js/scenario/engine.mjs':'becc64dfe035cb136e57a7fd5aa1fbfd7b3c82b83cb64ad6f8a7dba536217490',
    '../js/scenario/schema.mjs':'e42f01fc477ed1c1d65b6bd9fd8a8ae83a3e24df0e81b3df830b619d518c0627',
    '../js/scenario/storage.mjs':'e66d5388e2ea5a75fbc138fc86602193197a3953ef1db777b27c764c56e386b8',
    '../data/scenario/model-registry.json':'61b493d14c4a3e3b52612be10bea286a446ade78c73b38275c84d2bf632c3462',
    '../data/scenario/capabilities.json':'2ee99a76efaf2aaa991726ca76ec846ea68d04ac25b9611e0ae9fa787efcc20f',
    '../data/scenario/chemicals.json':'6286710591edabc1ffcf66a774aff5f865865958db7b1a689a4ff34d36284922',
  };
  for(const [file,sha]of Object.entries(baselines)) {
    let bytes=fs.readFileSync(new URL(file,import.meta.url));
    if(file.endsWith('/capabilities.json')) {
      assert.equal(JSON.parse(bytes).appVersion,APP_VERSION);
      const text=bytes.toString('utf8'),current='"appVersion":"0.2.1"';
      assert.equal(text.split(current).length,2,'only one declared capabilities app version');
      // The application version is the only permitted metadata change. Restore
      // that exact token before checking every other byte against real main.
      bytes=Buffer.from(text.replace(current,'"appVersion":"0.2.0"'));
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,file);
  }
  assert.equal(catalogs.capabilities.screeningEnabled,false);assert.deepEqual(catalogs.capabilities.approvedChemicalIds,[]);
  for(const material of catalogs.chemicals.materials)assert.deepEqual(material.properties,{});
  for(const model of catalogs.registry.models){assert.equal(model.technicalReview,null);assert.equal(model.allowedUse,'teaching');}
  const p=createPreset(catalogs),result=await assess(p,catalogs.scenarios.scenarios.find(s=>s.id==='pool-fire'));
  for(const output of Object.values(result.outputs)){assert.equal(output.value,null);assert.equal(output.status,'not_evaluated');}
});

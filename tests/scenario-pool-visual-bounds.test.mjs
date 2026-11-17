import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POOL_VISUAL as P,poolVisualHeight,poolLateralSupport,poolVisualBounds,poolLateralSupportGlsl} from '../js/scenario/rendering/pool-visual-bounds.mjs';
import {poolFireField} from '../js/scenario/effects/pool-fire.mjs';
import {createPreset} from '../js/scenario/presets.mjs';
import {buildSceneSpec} from '../js/scenario/scene-spec.mjs';
const c=Object.fromEntries(Object.entries({chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios'}).map(([k,v])=>[k,JSON.parse(fs.readFileSync(new URL('../data/scenario/'+v+'.json',import.meta.url),'utf8'))]));
const inside=(p,b)=>['x','y','z'].every(k=>p[k]>=b.min[k]-1e-10&&p[k]<=b.max[k]+1e-10);

test('pool AABB height includes full art smoke envelope for default and legal r=2',()=>{
 for(const radius of [1.2,2]){
  const p=createPreset(c);p.inputs.pool.radiusM=radius;const before=JSON.stringify(p),s=buildSceneSpec(p,c),rootZ=s.equipment.anchors.poolCenter.z+P.rootLiftM;
  assert.equal(s.support.canPlayDetailedStoryboard,true);assert.equal(JSON.stringify(p),before);
  assert.ok(s.process.domain.max.z>rootZ+poolVisualHeight(radius)*P.normalizedHeightMax);
  assert.ok(s.process.domain.max.z>7);
 }
 assert.equal(poolVisualBounds(1.2,{x:3.95,y:0,z:.03},{x:1,y:0,z:0}).max.z,8.306);
 assert.ok(Math.abs(poolVisualBounds(2,{x:3.95,y:0,z:.03}).max.z-13.66)<1e-12);
});

test('all noise-curl and signed-wind smoke extrema lie strictly inside the visual AABB',()=>{
 const center={x:3.95,y:-.3,z:.03};
 for(const radius of [.1,.5,1.2,2,5])for(const wind of [{x:1,y:0,z:.08},{x:-.6,y:.8,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:0}]){
  const bounds=poolVisualBounds(radius,center,wind);
  for(let i=0;i<=200;i++){
   const h=P.normalizedHeightMax*i/200,smoke=radius*(P.smokeRadiusBase+h*P.smokeRadiusGrowth),curl=radius*h*P.curlAmplitude*P.noiseOffsetMax;
   for(const signX of [-1,1])for(const signY of [-1,1]){
    const p={x:center.x+wind.x*P.windAmplitude*h*h+signX*(smoke+curl),y:center.y+wind.y*P.windAmplitude*h*h+signY*(smoke+curl),z:center.z+P.rootLiftM+poolVisualHeight(radius)*h};
    assert.ok(inside(p,bounds),JSON.stringify({radius,wind,h,p,bounds}));
   }
  }
 }
});

test('per-height rejection support provably contains base, lobes, smoke and maximum curl',()=>{
 const base=P.baseRadius*P.baseOuterFactor;
 // Lobe PER-AXIS support upper bound is affine in h on [0,hMax]. Its two endpoints
 // therefore prove that the shared base bound covers EVERY intermediate h.
 const lobe=(h)=>P.lobeOffset*(1-h*P.lobeTaper)+P.noiseOffsetMax*h*P.lobeCurl+P.lobeWidthMax*P.lobeOuterFactor;
 assert.ok(base>=lobe(0));assert.ok(base>=lobe(P.normalizedHeightMax));
 assert.equal(P.noiseOffsetMax,.5,'normalized R8 noise minus .5 bounds every curl component');
 assert.match(poolFireField,/noise3\(flow \* \.7 \+ 39\.0\)\) - \.5/);
 for(const radius of [.1,1.2,2,5])for(let i=0;i<=1000;i++){
  const h=P.normalizedHeightMax*i/1000,curl=radius*h*P.curlAmplitude*P.noiseOffsetMax,
    smoke=radius*(P.smokeRadiusBase+h*P.smokeRadiusGrowth),bound=poolLateralSupport(radius,h);
  assert.ok(bound+1e-12>=radius*base+curl);
  assert.ok(bound+1e-12>=radius*lobe(h)+curl);
  assert.ok(bound+1e-12>=smoke+curl);
 }
 assert.ok(poolFireField.includes(poolLateralSupportGlsl));
 assert.ok(poolFireField.indexOf('lateralSupport')<poolFireField.indexOf('fbm('),'reject before expensive density/noise evaluations');
});

test('visual bounds do not depend on inventory, pressure or temperature',()=>{
 const p=createPreset(c),before=buildSceneSpec(p,c).process.domain;
 p.inputs.storage.volumeM3=5;p.inputs.storage.pressurePa=99000;p.inputs.material.temperatureK=298.15;
 assert.deepEqual(buildSceneSpec(p,c).process.domain,before);
});

test('other process domains retain their exact existing geometry semantics',()=>{
 for(const id of ['propane-gas-pipeline-jet-fire','propane-gas-pipeline-flash-fire','propane-gas-pipeline-vce']){
  const p=createPreset(c,id),s=buildSceneSpec(p,c);
  assert.deepEqual(s.process.domain,{min:{x:-3,y:-3,z:0},max:{x:9,y:4,z:Math.max(6,p.inputs.equipment.geometry.heightM+4)}});
 }
 const p=createPreset(c,'propane-cabinet-confined-deflagration'),s=buildSceneSpec(p,c),w=p.inputs.equipment.geometry.diameterM,h=p.inputs.equipment.geometry.heightM,depth=w*5/6;
 assert.deepEqual(s.process.domain,{min:{x:-w,y:-depth/2-4,z:0},max:{x:w,y:depth/2+1,z:h+2}});
});

test('invalid artistic support inputs are rejected rather than inventing an engineering bound',()=>{
 for(const radius of [0,-1,NaN,Infinity])assert.throws(()=>poolVisualBounds(radius,{x:0,y:0,z:0}));
 assert.throws(()=>poolVisualBounds(1.2,{x:NaN,y:0,z:0}));
});

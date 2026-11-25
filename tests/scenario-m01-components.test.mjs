import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createPreset} from '../js/scenario/presets.mjs';
import {buildSceneSpec,sampleStoryboard} from '../js/scenario/scene-spec.mjs';
import {worldToThree} from '../js/scenario/coordinates.mjs';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url)),{build}=require('esbuild');
const {Raycaster,Vector3}=require('three');
const compiled=await build({entryPoints:[fileURLToPath(new URL('../js/scenario/kimi-m01/assembly.mjs',import.meta.url))],nodePaths:[fileURLToPath(new URL('../build/scenario/node_modules',import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});
const {createM01Assembly}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const files={chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios',capabilities:'capabilities',registry:'model-registry',sources:'source-manifest'},catalogs=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,JSON.parse(fs.readFileSync(new URL('../data/scenario/'+v+'.json',import.meta.url),'utf8'))]));
const make=()=>buildSceneSpec(createPreset(catalogs),catalogs);
const registry=()=>{const counts={geometry:0,material:0,texture:0,disposedGeometry:0,disposedMaterial:0,disposedTexture:0};return{counts,hooks:{createdGeometry(){counts.geometry++;},createdMaterial(){counts.material++;},createdTexture(){counts.texture++;},disposedGeometry(){counts.disposedGeometry++;},disposedMaterial(){counts.disposedMaterial++;},disposedTexture(){counts.disposedTexture++;}}};};
const walk=group=>{const list=[];group.traverse(obj=>list.push(obj));return list;};
const approx=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-5,`${message}: ${a} != ${b}`);
const snapshot=group=>walk(group).map(object=>({name:object.name,visible:object.visible,position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),instances:object.instanceMatrix?Array.from(object.instanceMatrix.array):null,materials:(Array.isArray(object.material)?object.material:[object.material]).filter(Boolean).map(m=>({opacity:m.opacity,uniforms:Object.fromEntries(Object.entries(m.uniforms||{}).filter(([,u])=>typeof u.value==='number').map(([k,u])=>[k,u.value]))}))}));

test('M01 anchors coincide with equipment nodes under exactly one ENU-to-Three transform',()=>{
  const spec=make(),a=createM01Assembly(spec);
  try {
    a.update(spec,sampleStoryboard(spec,.4,17));a.group.updateMatrixWorld(true);
    assert.equal(a.group.userData.visualAdapter,'kimi-m01');const layout=a.group.userData.layout;assert.ok(layout?.valid);
    for(const [name,key]of [['Anchor_TankBase','tankBase'],['Anchor_Leak','leak'],['Anchor_Pool','poolCenter']]) {
      const node=a.group.getObjectByName(name);assert.ok(node,name);
      const actual=node.getWorldPosition(node.position.clone()).toArray(),expected=worldToThree(layout.anchors[key]);
      for(let i=0;i<3;i++)approx(actual[i],expected[i],`${name} axis${i}`);
    }
    for(const label of a.labels)for(const axis of ['x','y','z'])assert.equal(Number.isFinite(label.point[axis]),true);
    const shell=walk(a.group).find(o=>o.isMesh&&/Tank_Shell|TankBody|tank-shell|TankShell/i.test(o.name));
    assert.ok(shell,'an actual tank shell must exist');assert.equal(shell.material.transparent,false);assert.equal(shell.material.depthWrite,true);
  } finally {a.dispose();}
});

test('M01 rendered pool vertices stay within the current containment, not only a nominal radius',()=>{
  const spec=make(),a=createM01Assembly(spec);
  try {
    a.update(spec,sampleStoryboard(spec,.7,17));a.group.updateMatrixWorld(true);
    for(const name of ['Pool_WetSurface_R1p2m','Pool_TeachingOutline']) {
      const object=a.group.getObjectByName(name);assert.ok(object,name);assert.ok(object.visible);
      const positions=object.geometry.attributes.position,origin=spec.equipment.anchors.tank;
      const halfX=spec.equipment.containment.lengthM/2,halfY=spec.equipment.containment.widthM/2;
      for(let i=0;i<positions.count;i++) {
        const point=object.position.clone().set(positions.getX(i),positions.getY(i),positions.getZ(i)).applyMatrix4(object.matrixWorld);
        assert.ok(Math.abs(point.x-origin.x)<=halfX+1e-5,`${name} vertex ${i}: outside length`);
        assert.ok(Math.abs(-point.z-origin.y)<=halfY+1e-5,`${name} vertex ${i}: outside width`);
      }
    }
  } finally {a.dispose();}
});

test('M01 downstream nozzle has a true open bore, not a solid visual end cap',()=>{
  const spec=make(),a=createM01Assembly(spec);
  try {
    a.group.updateMatrixWorld(true);
    const pipe=a.group.getObjectByName('DownstreamShortPipe'),flange=a.group.getObjectByName('Flange_3'),gasket=a.group.getObjectByName('FlangeGasket_3');
    assert.ok(pipe&&flange&&gasket);assert.equal(pipe.userData.openOutlet,true);
    const straight=new Raycaster(new Vector3(.9,.72,3.3),new Vector3(0,0,-1),0,.7);
    assert.equal(straight.intersectObjects([pipe,flange,gasket],false).length,0,'centre ray passes through the bore');
    const wall=new Raycaster(new Vector3(.985,.72,3.3),new Vector3(0,0,-1),0,.7);
    assert.ok(wall.intersectObject(pipe,false).length>0,'off-centre ray hits the actual pipe wall');
  } finally {a.dispose();}
});

test('M01 seek/pause frames are history-free, with no per-frame allocations and balanced owned resources',()=>{
  const spec=make(),{counts,hooks}=registry(),a=createM01Assembly(spec,hooks);
  a.update(spec,sampleStoryboard(spec,0,17));const initial={...counts};
  try {
    for(let i=0;i<40;i++)a.update(spec,sampleStoryboard(spec,i/39,17));
    assert.equal(counts.geometry,initial.geometry);assert.equal(counts.material,initial.material);assert.equal(counts.texture,initial.texture);
    a.update(spec,sampleStoryboard(spec,.7,17));const before=snapshot(a.group);
    a.update(spec,sampleStoryboard(spec,.94,17));a.update(spec,sampleStoryboard(spec,.7,17));assert.deepEqual(snapshot(a.group),before);
    const retained=snapshot(a.group);a.update(spec,sampleStoryboard(spec,.7,17));assert.deepEqual(snapshot(a.group),retained,'same paused frame is unchanged');
  } finally {a.dispose();}
  assert.ok(counts.geometry>0);assert.ok(counts.material>0);
  assert.equal(counts.geometry,counts.disposedGeometry);assert.equal(counts.material,counts.disposedMaterial);assert.equal(counts.texture,counts.disposedTexture);
  assert.equal(a.group.children.length,0);const once={...counts};a.dispose();assert.deepEqual(counts,once,'idempotent disposal');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createPreset} from '../js/scenario/presets.mjs';
import {buildSceneSpec,sampleStoryboard} from '../js/scenario/scene-spec.mjs';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url)),{build}=require('esbuild');
const compiled=await build({entryPoints:[fileURLToPath(new URL('../js/scenario/three/scene-components.mjs',import.meta.url))],nodePaths:[fileURLToPath(new URL('../build/scenario/node_modules',import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});
const {createSceneAssembly}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const files={chemicals:'chemicals',equipment:'equipment',presets:'presets',visualProfiles:'visual-profiles',scenarios:'scenarios',capabilities:'capabilities',registry:'model-registry',sources:'source-manifest'},catalogs=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,JSON.parse(fs.readFileSync(new URL('../data/scenario/'+v+'.json',import.meta.url),'utf8'))]));
const make=id=>buildSceneSpec(createPreset(catalogs,id),catalogs),walk=assembly=>{const objects=[];assembly.group.traverse(o=>objects.push(o));return objects;};
const registry=()=>{const counts={geometry:0,material:0,texture:0,disposedGeometry:0,disposedMaterial:0,disposedTexture:0};return {counts,hooks:{createdGeometry(){counts.geometry++;},createdMaterial(){counts.material++;},createdTexture(){counts.texture++;},disposedGeometry(){counts.disposedGeometry++;},disposedMaterial(){counts.disposedMaterial++;},disposedTexture(){counts.disposedTexture++;}}};};

test('R14 industrial assemblies allocate once across seeks and dispose every owned geometry/material/texture',()=>{
 for(const preset of catalogs.presets.presets){const spec=make(preset.presetId);if(!spec.support.canPlayDetailedStoryboard)continue;const {counts,hooks}=registry(),a=createSceneAssembly(spec,hooks),initial={...counts};try{for(let i=0;i<40;i++)a.update(spec,sampleStoryboard(spec,i/39,7),{cutaway:i%2===0});assert.equal(counts.geometry,initial.geometry,preset.presetId);assert.equal(counts.material,initial.material);assert.equal(counts.texture,initial.texture);const shell=walk(a).find(o=>o.name==='opaque-tank-shell');if(shell){assert.equal(shell.material.transparent,false);assert.equal(shell.material.depthWrite,true);}assert.equal(walk(a).some(o=>/flame|cross-plane/.test(o.name)),false);}finally{a.dispose();}assert.equal(counts.geometry,counts.disposedGeometry);assert.equal(counts.material,counts.disposedMaterial);assert.equal(counts.texture,counts.disposedTexture);assert.equal(a.group.children.length,0);}
});

test('R04/11/12 liquid reaches the ground before wetting; feed termination retains neutral wetness and seeks reproduce',()=>{
 const spec=make('methanol-atmospheric-tank-pool-fire'),a=createSceneAssembly(spec),objects=walk(a),stream=objects.find(o=>o.name==='gravity-liquid-column'),wet=objects.find(o=>o.name==='continuous-wet-front'),drops=objects.find(o=>o.name==='deterministic-impact-droplets'),boundary=objects.find(o=>o.name==='assisted-liquid-boundary'),seek=p=>a.update(spec,sampleStoryboard(spec,p,7));
 try{seek(.16);assert.equal(stream.visible,true);assert.equal(wet.visible,false);seek(.4);assert.equal(wet.visible,true);assert.equal(boundary.visible,true);seek(1);assert.equal(stream.visible,false);assert.equal(wet.visible,true);const c=wet.material.color;assert.ok(Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b)<.12,'neutral liquid rather than saturated blue');const hash=()=>createHash('sha256').update(Buffer.from(drops.instanceMatrix.array.buffer)).update(Buffer.from(boundary.geometry.attributes.position.array.buffer)).digest('hex');seek(.7);const old=hash();seek(.9);seek(.7);assert.equal(hash(),old);spec.visual.mode='natural';seek(.7);assert.equal(boundary.visible,false);assert.equal(wet.visible,true);}finally{a.dispose();}
});

test('R01/09/10 pipe congestion and cabinet cutaway have distinct geometry and a real unfilled vent aperture',()=>{
 const sparse=createSceneAssembly(make('propane-gas-pipeline-jet-fire')),crowded=createSceneAssembly(make('propane-gas-pipeline-vce')),spec=make('propane-cabinet-confined-deflagration'),cabinet=createSceneAssembly(spec);
 try{assert.equal(sparse.group.userData.geometryKind,'pipe-rack');assert.ok(walk(crowded).length>walk(sparse).length*2);assert.equal(walk(crowded).some(o=>o.name==='opaque-tank-shell'),false);const o=spec.process.enclosure.opening,panels=walk(cabinet).filter(x=>x.name==='cabinet-front-wall');assert.equal(panels.length,4);for(const wall of panels){const b=wall.geometry.parameters,x=wall.position.x,z=wall.position.y;assert.equal(Math.abs(o.center.x-x)<b.width/2-.001&&Math.abs(o.center.z-z)<b.height/2-.001,false,'aperture is not a transparent whole wall');assert.equal(wall.material.transparent,false);assert.equal(wall.material.depthWrite,true);}cabinet.update(spec,sampleStoryboard(spec,.74,7),{cutaway:true});assert.equal(panels.every(p=>!p.visible),true);assert.ok(walk(cabinet).filter(x=>x.isLineSegments&&x.visible).length>=5);cabinet.update(spec,sampleStoryboard(spec,.74,7),{cutaway:false});assert.equal(panels.every(p=>p.visible),true);}finally{sparse.dispose();crowded.dispose();cabinet.dispose();}
});

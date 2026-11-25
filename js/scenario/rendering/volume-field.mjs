import * as THREE from 'three';
import { worldToThree } from '../coordinates.mjs';
import { makeNoiseVolume, NOISE_SIZE } from './noise-data.mjs';
import { poolVisualHeight, POOL_VISUAL } from './pool-visual-bounds.mjs';
export const VOLUME_SCENARIOS = ['pool-fire','jet-fire','flash-fire','vapor-cloud-explosion','confined-deflagration','vce'];
const point=(p,f={x:0,y:0,z:0})=>new THREE.Vector3(...worldToThree(p||f));
const clamp=(x)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

/** Fixed-seed periodic 3D noise. 64^3 R8 = 256 KiB, not a CFD cache. */
export function createNoiseVolume(lifecycle) {
  const size=NOISE_SIZE,data=makeNoiseVolume();
  const texture=new THREE.Data3DTexture(data,size,size,size);
  texture.format=THREE.RedFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.wrapS=texture.wrapT=texture.wrapR=THREE.RepeatWrapping;
  texture.unpackAlignment=1;texture.needsUpdate=true;
  lifecycle.createdTexture?.();
  return {texture,bytes:data.byteLength,dispose(){texture.dispose();lifecycle.disposedTexture?.();}};
}

// This maps explicit visual configuration only. No pressure/inventory scaling.
export function volumeState(spec,frame) {
  const process=spec.process||{},anchors=spec.equipment.anchors,
    root=point(anchors.poolCenter||process.nozzle?.position||anchors.leak||anchors.tank),
    nozzle=point(process.nozzle?.position||anchors.leak||anchors.tank),
    direction=point(process.nozzle?.direction||process.direction||{x:1,y:0,z:0}).normalize(),
    radius=Number.isFinite(spec.pool.radiusM)?spec.pool.radiusM:1.2,
    cloud=process.cloud||{},enclosure=process.enclosure||{},
    min=point(process.domain?.min||{x:-7,y:-6,z:0}),
    max=point(process.domain?.max||{x:10,y:6,z:8}),
    box=new THREE.Box3().setFromPoints([min,max]),
    bounds=box.getSize(new THREE.Vector3()),
    enclosureBox=new THREE.Box3().setFromPoints([point(enclosure.min||{x:-2,y:-1.5,z:0}),point(enclosure.max||{x:2,y:1.5,z:3})]),
    opening=enclosure.opening||{},
    profile=spec.visual.profile||{},pure=spec.material.composition==='pure';
  root.y+=spec.visualAdapter==='kimi-m01'?.005:POOL_VISUAL.rootLiftM;
  const colour=new THREE.Color(pure&&/^#[0-9a-f]{6}$/i.test(profile.color)?profile.color:'#e6a35a');
  const pressure=frame.pressureProgress;
  return {
    kind:['pool-fire','jet-fire','flash-fire','vapor-cloud-explosion','confined-deflagration'].indexOf(process.kind==='vce'?'vapor-cloud-explosion':process.kind||(spec.sceneId==='vce'?'vapor-cloud-explosion':spec.sceneId)),
    root,nozzle,direction,
    min:box.min,max:box.max,bounds,
    cloudCenter:point(cloud.center||{x:3,y:0,z:1}),
    cloudRadii:point(cloud.radii||{x:3,y:2,z:1}).set(...worldToThree(cloud.radii||{x:3,y:2,z:1}).map(Math.abs)),
    ignition:point(process.ignition?.position||anchors.poolCenter||anchors.leak||anchors.tank),
    enclosureMin:enclosureBox.min,enclosureMax:enclosureBox.max,
    vent:point(opening.center||process.nozzle?.position||anchors.leak||anchors.tank),
    ventDirection:point(opening.direction||process.direction||{x:1,y:0,z:0}).normalize(),
    wind:point(process.direction||{x:1,y:0,z:0}),
    radius,nozzleRadius:process.nozzle?.radiusM||.045,visualHeight:poolVisualHeight(radius),jetLength:Number.isFinite(process.jetLengthM)?process.jetLengthM:6.2,
    time:Number.isFinite(frame.noiseTime)?frame.noiseTime:frame.progress*13,
    fire:clamp(frame.fireIntensity??(frame.fireVisible?1:0)),
    release:clamp(frame.releaseIntensity??(frame.leakVisible?1:0)),
    cloudGrowth:clamp(frame.cloudGrowth),front:clamp(frame.combustionProgress??frame.fireGrowth),
    ventFire:clamp(frame.ventIntensity),dissipation:clamp(frame.dissipation),
    pressureProgress:Number.isFinite(pressure)?clamp(pressure):-1,
    colour,visibility:pure?clamp(spec.visual.mode==='natural'?profile.naturalOpacity:profile.assistedOpacity):.65,
    assisted:spec.visual.mode!=='natural',methanol:spec.material.id==='methanol',
    smoke:profile.smoke==='generic'?.85:spec.material.id==='methanol'?0:.08,
  };
}

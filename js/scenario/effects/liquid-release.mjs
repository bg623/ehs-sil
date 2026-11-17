import * as THREE from 'three';
import {worldToThree} from '../coordinates.mjs';
import {createGrainTexture} from '../materials/industrial-palette.mjs';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),finite=(n,f)=>Number.isFinite(n)?n:f,fract=n=>n-Math.floor(n);
const v3=p=>new THREE.Vector3(...worldToThree(p));

/** Preset visual liquid, not a source-term, hydraulics or shallow-water solver. */
export function createLiquidRelease(spec,lifecycle={}){
 const group=new THREE.Group();group.name='liquid-release';
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const geometry=g=>{geometries.add(g);lifecycle.createdGeometry?.();return g;},material=m=>{materials.add(m);lifecycle.createdMaterial?.();return m;},texture=t=>{textures.add(t);lifecycle.createdTexture?.();return t;};
 const liquid=spec.process?.liquid;
 if(!liquid)return {group,update(){},dispose(){group.removeFromParent();group.clear();}};
 const outlet=v3(liquid.outlet),impact=v3(liquid.groundImpact),center=liquid.poolCenter,radius=Math.max(.08,finite(liquid.wetRadiusM,spec.pool?.radiusM||1.2));
 const normal=texture(createGrainTexture('liquid'));normal.repeat.set(5,5);
 const flowUniforms={uLiquidTime:{value:0},uReleaseFront:{value:0},uLiquidTail:{value:0}};
 const streamMat=material(new THREE.MeshPhysicalMaterial({color:'#e0e3db',roughness:.11,metalness:.04,clearcoat:.8,clearcoatRoughness:.1,transparent:true,opacity:.58,normalMap:normal,normalScale:new THREE.Vector2(.12,.12),depthWrite:false,side:THREE.DoubleSide}));
 streamMat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,flowUniforms);
  shader.vertexShader='uniform float uLiquidTime; varying float vReleaseAlong;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvReleaseAlong=uv.x; transformed += normal * (.0025*sin(uv.x*48.0-uLiquidTime*11.0)+.0015*sin(uv.x*79.0+uLiquidTime*7.0));');
  shader.fragmentShader='uniform float uReleaseFront; uniform float uLiquidTail; varying float vReleaseAlong;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= (1.0-smoothstep(uReleaseFront-.035,uReleaseFront+.015,vReleaseAlong))*smoothstep(uLiquidTail-.025,uLiquidTail+.025,vReleaseAlong);\n#include <alphatest_fragment>');
 };
 streamMat.customProgramCacheKey=()=> 'ehs-liquid-column-v020';
 const middle=outlet.clone().lerp(impact,.48);middle.y=outlet.y*.82+impact.y*.18;
 const curve=new THREE.QuadraticBezierCurve3(outlet,middle,impact),stream=new THREE.Mesh(geometry(new THREE.TubeGeometry(curve,44,.034,8,false)),streamMat);stream.name='gravity-liquid-column';stream.renderOrder=2;group.add(stream);
 const bounds=spec.equipment.containment||{},origin=spec.equipment.anchors?.tank||{x:0,y:0,z:0},tankRadius=spec.process.geometryKind==='tank'?finite(spec.equipment.geometry.diameterM,0)/2+.27:0;
 const wetUniforms={uWetCenter:{value:new THREE.Vector2(center.x,center.y)},uWetRadius:{value:0},uWetTime:{value:0},uTankCenter:{value:new THREE.Vector2(origin.x,origin.y)},uTankRadius:{value:tankRadius},uWetBounds:{value:new THREE.Vector4(origin.x-finite(bounds.lengthM,30)/2+.13,origin.x+finite(bounds.lengthM,30)/2-.13,origin.y-finite(bounds.widthM,30)/2+.13,origin.y+finite(bounds.widthM,30)/2-.13)}};
 const wetMat=material(new THREE.MeshPhysicalMaterial({color:'#aeb5ad',roughness:.12,metalness:.1,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.4,normalMap:normal,normalScale:new THREE.Vector2(.065,.065),depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));
 wetMat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,wetUniforms);
  shader.vertexShader='varying vec3 vWetPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWetPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 vWetPosition; uniform vec2 uWetCenter; uniform float uWetRadius; uniform float uWetTime; uniform vec2 uTankCenter; uniform float uTankRadius; uniform vec4 uWetBounds;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`vec2 wetXY=vec2(vWetPosition.x,-vWetPosition.z);vec2 wetDelta=wetXY-uWetCenter;float wetAngle=atan(wetDelta.y,wetDelta.x);float wetEdge=uWetRadius*(1.0+.035*sin(wetAngle*7.0)+.022*cos(wetAngle*11.0));float wetMask=1.0-smoothstep(wetEdge-.045,wetEdge+.025,length(wetDelta));wetMask*=smoothstep(uTankRadius,uTankRadius+.06,length(wetXY-uTankCenter));wetMask*=smoothstep(uWetBounds.x,uWetBounds.x+.05,wetXY.x)*(1.0-smoothstep(uWetBounds.y-.05,uWetBounds.y,wetXY.x));wetMask*=smoothstep(uWetBounds.z,uWetBounds.z+.05,wetXY.y)*(1.0-smoothstep(uWetBounds.w-.05,uWetBounds.w,wetXY.y));diffuseColor.a*=wetMask;\n#include <alphatest_fragment>`);
 };
 wetMat.customProgramCacheKey=()=> 'ehs-wet-front-v020';
 const wet=new THREE.Mesh(geometry(new THREE.PlaneGeometry(radius*2.2,radius*2.2,1,1)),wetMat);wet.name='continuous-wet-front';wet.rotation.x=-Math.PI/2;wet.position.copy(v3({...center,z:Math.max(center.z,impact.y)+.012}));wet.renderOrder=1;group.add(wet);
 const boundaryArray=new Float32Array(97*3),boundaryGeometry=geometry(new THREE.BufferGeometry());boundaryGeometry.setAttribute('position',new THREE.BufferAttribute(boundaryArray,3));
 const boundaryMat=material(new THREE.LineBasicMaterial({color:'#83938e',transparent:true,opacity:.55,depthWrite:false})),boundary=new THREE.Line(boundaryGeometry,boundaryMat);boundary.name='assisted-liquid-boundary';boundary.renderOrder=3;group.add(boundary);
 const drops=new THREE.InstancedMesh(geometry(new THREE.SphereGeometry(.026,6,5)),material(new THREE.MeshPhysicalMaterial({color:'#e4e5de',roughness:.12,metalness:.04,clearcoat:1,transparent:true,opacity:.58,depthWrite:false})),22);drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);drops.name='deterministic-impact-droplets';drops.frustumCulled=false;group.add(drops);
 const transform=new THREE.Matrix4(),dropPosition=new THREE.Vector3(),dropScale=new THREE.Vector3(),rotation=new THREE.Quaternion();
 const ripple=new THREE.Mesh(geometry(new THREE.RingGeometry(.11,.15,40)),material(new THREE.MeshBasicMaterial({color:'#c5cdc2',transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide})));ripple.name='impact-reflection-ripple';ripple.rotation.x=-Math.PI/2;ripple.position.copy(impact);ripple.position.y+=.018;group.add(ripple);
 let disposed=false;
 return {group,
  update(current,frame){
   if(disposed)return;const t=finite(frame.noiseTime,0),feed=clamp(finite(frame.releaseIntensity,frame.leakVisible?1:0)),front=clamp(finite(frame.releaseFront,feed)),tail=clamp(finite(frame.liquidTail,0)),wetness=clamp(finite(frame.poolRetention,frame.poolScale||0))*clamp((front-.94)/.06),assisted=current.visual.mode==='assisted';
   flowUniforms.uLiquidTime.value=t;flowUniforms.uReleaseFront.value=front;flowUniforms.uLiquidTail.value=tail;stream.visible=front>0&&tail<.999;streamMat.opacity=assisted?.62:.42;
   normal.offset.set(t*.018,t*.011);const wetX=impact.x+(center.x-impact.x)*wetness,wetY=-impact.z+(center.y+impact.z)*wetness;wet.position.x=wetX;wet.position.z=-wetY;wetUniforms.uWetCenter.value.set(wetX,wetY);wetUniforms.uWetRadius.value=radius*Math.sqrt(wetness);wetUniforms.uWetTime.value=t;wet.visible=wetness>.002;wetMat.opacity=assisted?.49:.31;
   boundary.visible=assisted&&wet.visible;const r=wetUniforms.uWetRadius.value,b=wetUniforms.uWetBounds.value;
   for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,organic=1+.035*Math.sin(a*7)+.022*Math.cos(a*11);let x=wetX+Math.cos(a)*r*organic,y=wetY+Math.sin(a)*r*organic;const dx=x-origin.x,dy=y-origin.y,length=Math.hypot(dx,dy);if(length<tankRadius+.04&&length>0){x=origin.x+dx/length*(tankRadius+.04);y=origin.y+dy/length*(tankRadius+.04);}boundaryArray[i*3]=clamp(x,b.x,b.y);boundaryArray[i*3+1]=wet.position.y+.008;boundaryArray[i*3+2]=-clamp(y,b.z,b.w);}
   boundaryGeometry.attributes.position.needsUpdate=true;boundaryGeometry.computeBoundingSphere();
   const splash=feed*(.5+.5*front)*(1-tail);drops.visible=splash>.015;
   for(let i=0;i<22;i++){const phase=fract(t*1.65+i*.61803398875),angle=i*2.39996323,range=(.045+.32*phase)*(.7+.3*Math.sin(i*8.31));dropPosition.set(impact.x+Math.cos(angle)*range,impact.y+.022+Math.sin(phase*Math.PI)*(.11+.07*fract(i*.37)),impact.z+Math.sin(angle)*range);const size=(.32+.45*(1-phase))*Math.sqrt(Math.max(.001,splash));dropScale.set(size,size*(1.4-phase*.4),size);transform.compose(dropPosition,rotation,dropScale);drops.setMatrixAt(i,transform);}drops.instanceMatrix.needsUpdate=true;
   ripple.visible=splash>.02;const rippleScale=.7+fract(t*1.3)*1.8;ripple.scale.setScalar(rippleScale);ripple.material.opacity=(1-fract(t*1.3))*.24*splash;
  },
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();for(const g of geometries){g.dispose();lifecycle.disposedGeometry?.();}for(const m of materials){m.dispose();lifecycle.disposedMaterial?.();}for(const t of textures){t.dispose();lifecycle.disposedTexture?.();}geometries.clear();materials.clear();textures.clear();},
 };
}

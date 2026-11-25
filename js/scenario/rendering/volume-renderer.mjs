import * as THREE from 'three';
import { createNoiseVolume, volumeState } from './volume-field.mjs';
import { poolFireField } from '../effects/pool-fire.mjs';
import { m01PoolFireField } from '../effects/m01-pool-fire.mjs';
import { m01Progress } from '../kimi-m01/contract.mjs';
import { jetFireField } from '../effects/jet-fire.mjs';
import { flashFireField } from '../effects/flash-fire.mjs';
import { vceField } from '../effects/vce.mjs';
import { confinedDeflagrationField } from '../effects/confined-deflagration.mjs';

export const QUALITY_PROFILES={low:{steps:40,scale:.42,dpr:1},balanced:{steps:72,scale:.62,dpr:1.35},high:{steps:112,scale:.85,dpr:1.65}};
const vertex=`out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment=`
precision highp float;precision highp sampler3D;
in vec2 vUv;out vec4 fragColor;
uniform sampler3D uNoise;uniform sampler2D uDepth;
uniform mat4 uInvProjection,uCameraWorld;uniform vec3 uCamera,uMin,uMax;
uniform int uSteps,uKind;uniform float uTime,uRadius,uNozzleRadius,uVisualHeight,uJetLength;
uniform vec3 uRoot,uNozzle,uDirection,uWind,uCloudCenter,uCloudRadii,uIgnition;
uniform vec3 uEnclosureMin,uEnclosureMax,uVent,uVentDirection,uColour;
uniform float uFire,uRelease,uCloudGrowth,uFront,uVentFire,uDissipation,uSmoke;
uniform float uVisibility,uAssisted,uMethanol,uPressure,uPressureProgress,uEnabled;
uniform float uM01,uM01Progress;
struct Field{float fire;float smoke;float gas;float heat;float aux;};
Field emptyField(){return Field(0.,0.,0.,0.,0.);}
float noise3(vec3 p){return texture(uNoise,p*.057).r;}
float fbm(vec3 p){return noise3(p)*.55+noise3(p*2.07+11.3)*.29+noise3(p*4.13-7.2)*.16;}
${poolFireField}
${m01PoolFireField}
${jetFireField}
${flashFireField}
${vceField}
${confinedDeflagrationField}
Field field(vec3 p){
 if(uKind==0){if(uM01>.5)return m01PoolFire(p);return poolFire(p);}if(uKind==1)return jetFire(p);if(uKind==2)return flashFire(p);
 if(uKind==3)return vaporCloudExplosion(p);if(uKind==4)return confinedDeflagration(p);return emptyField();
}
vec2 intersectBox(vec3 ro,vec3 rd){
 vec3 safeDir=rd;safeDir.x=abs(rd.x)<1.e-6?1.e-6:rd.x;safeDir.y=abs(rd.y)<1.e-6?1.e-6:rd.y;safeDir.z=abs(rd.z)<1.e-6?1.e-6:rd.z;
 vec3 t0=(uMin-ro)/safeDir,t1=(uMax-ro)/safeDir,lo=min(t0,t1),hi=max(t0,t1);
 return vec2(max(lo.x,max(lo.y,lo.z)),min(hi.x,min(hi.y,hi.z)));
}
void main(){
 if(uEnabled<.5){fragColor=vec4(0.);return;}
 vec2 ndc=vUv*2.-1.;vec4 farView=uInvProjection*vec4(ndc,1.,1.);farView/=farView.w;
 vec3 ray=normalize((uCameraWorld*vec4(farView.xyz,0.)).xyz);
 vec2 hit=intersectBox(uCamera,ray);float start=max(0.,hit.x),finish=hit.y;
 float depth=texture(uDepth,vUv).r;
 if(depth<.999999){
   vec4 opaqueView=uInvProjection*vec4(ndc,depth*2.-1.,1.);opaqueView/=opaqueView.w;
   vec3 opaqueWorld=(uCameraWorld*opaqueView).xyz;
   finish=min(finish,length(opaqueWorld-uCamera)-.012);
 }
 if(finish<=start){fragColor=vec4(0.);return;}
 float ds=(finish-start)/float(uSteps);float transmission=1.;vec3 emission=vec3(0.);
 for(int i=0;i<128;i++){
  if(i>=uSteps||transmission<.012)break;
  vec3 p=uCamera+ray*(start+(float(i)+.5)*ds);Field f=field(p);
  float gas=f.gas*uAssisted,flame=f.fire*uVisibility*mix(1.,1.65,uMethanol*uAssisted);
  float blueAbsorption=mix(.22,.95,uAssisted);
  float extinction=flame*mix(1.15,blueAbsorption,uMethanol)+f.smoke*1.8+gas*.48+f.aux*.5;
  float alpha=1.-exp(-max(0.,extinction)*ds);
  vec3 fireColor=mix(uColour*vec3(1.1,.72,.4),vec3(1.4,.65,.11),smoothstep(.38,.95,f.heat)*.8*(1.-uMethanol));
  fireColor=mix(fireColor,vec3(.025,.22,.95),uMethanol*.8);
  if(uKind==1){float s=dot(p-uNozzle,uDirection)/uJetLength;fireColor=mix(vec3(.055,.28,1.),fireColor,smoothstep(.015,.23,s));}
  float energy=mix(2.25,1.0,uMethanol);
  vec3 source=fireColor*flame*energy*(1.0+f.heat*.65);
  source+=vec3(.14,.15,.16)*f.smoke*.42+vec3(.31,.53,.65)*gas*.27+vec3(.36,.62,.69)*f.aux*.8;
  float integration=extinction>.0001?alpha/extinction:ds;
  if(uM01>.5){
   float d=pow(max(0.,f.fire),1.28)*1.25;
   extinction=d*mix(.26,3.15,uAssisted)*mix(.50,.96,uAssisted);
   alpha=1.-exp(-extinction*ds);
   float h=1.-f.heat;
   vec3 colour=mix(vec3(.025,.13,.58),vec3(.10,.46,.88),smoothstep(.03,.46,h));
   colour=mix(colour,vec3(.34,.75,1.),(1.-h)*smoothstep(.20,.90,d)*.62);
   colour*=mix(.46,1.18,uAssisted)*(1.+d*.45);
   source=colour*extinction;
   integration=extinction>.0001?alpha/extinction:ds;
  }
  emission+=transmission*source*integration;transmission*=1.-alpha;
 }
 fragColor=vec4(emission,1.-transmission);
}`;
const composite=`precision highp float;in vec2 vUv;out vec4 fragColor;uniform sampler2D uScene,uVolume;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 srgb(vec3 x){return mix(x*12.92,1.055*pow(max(x,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),x));}
void main(){vec4 v=texture(uVolume,vUv);vec3 scene=texture(uScene,vUv).rgb;fragColor=vec4(srgb(aces(v.rgb+scene*(1.-v.a))),1.);}`;

/** Two reusable render targets. No clock, no asynchronous scene loading. */
export function createVolumeRenderer(renderer,lifecycle) {
  const half=renderer.extensions.has('EXT_color_buffer_float'),type=half?THREE.HalfFloatType:THREE.UnsignedByteType;
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,stencilBuffer:false});
  sceneTarget.texture.colorSpace=THREE.LinearSRGBColorSpace;
  sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  sceneTarget.depthTexture.minFilter=sceneTarget.depthTexture.magFilter=THREE.NearestFilter;
  const volumeTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false,stencilBuffer:false});
  volumeTarget.texture.colorSpace=THREE.LinearSRGBColorSpace;
  for(let i=0;i<3;i++)lifecycle.createdTexture?.();
  const noise=createNoiseVolume(lifecycle),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));lifecycle.createdGeometry();
  const uniforms={uNoise:{value:noise.texture},uDepth:{value:sceneTarget.depthTexture},uInvProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uCamera:{value:new THREE.Vector3()},uSteps:{value:72},uKind:{value:0},uEnabled:{value:0}};
  const vectorNames=['Min','Max','Root','Nozzle','Direction','Wind','CloudCenter','CloudRadii','Ignition','EnclosureMin','EnclosureMax','Vent','VentDirection','Colour'];
  for(const name of vectorNames)uniforms['u'+name]={value:name==='Colour'?new THREE.Color():new THREE.Vector3()};
  for(const name of ['Time','Radius','NozzleRadius','VisualHeight','JetLength','Fire','Release','CloudGrowth','Front','VentFire','Dissipation','Smoke','Visibility','Assisted','Methanol','Pressure','PressureProgress','M01','M01Progress'])uniforms['u'+name]={value:0};
  const rayMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
  const compositeMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:vertex,fragmentShader:composite,uniforms:{uScene:{value:sceneTarget.texture},uVolume:{value:volumeTarget.texture}},depthTest:false,depthWrite:false,toneMapped:false});
  lifecycle.createdMaterial();lifecycle.createdMaterial();
  const quadScene=new THREE.Scene(),camera2d=new THREE.Camera(),quad=new THREE.Mesh(geometry,rayMaterial);quad.frustumCulled=false;quadScene.add(quad);
  let quality='balanced',width=1,height=1,volumeWidth=1,volumeHeight=1,renders=0,resizes=0,disposed=false,state=null;
  function resize(w,h,fullResolution=false){
    width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));
    const scale=fullResolution?1:QUALITY_PROFILES[quality].scale;
    volumeWidth=Math.max(1,Math.round(width*scale));volumeHeight=Math.max(1,Math.round(height*scale));
    if(sceneTarget.width!==width||sceneTarget.height!==height||volumeTarget.width!==volumeWidth||volumeTarget.height!==volumeHeight)resizes++;
    sceneTarget.setSize(width,height);volumeTarget.setSize(volumeWidth,volumeHeight);
  }
  function setQuality(value){if(!QUALITY_PROFILES[value])throw Error('画质档无效');quality=value;uniforms.uSteps.value=QUALITY_PROFILES[value].steps;resize(width,height);}
  function render(scene,camera,spec,frame,{pressure=false}={}){
    if(disposed)return;
    camera.updateMatrixWorld();
    state=spec&&frame?volumeState(spec,frame):null;
    uniforms.uM01.value=spec?.visualAdapter==='kimi-m01'?1:0;
    uniforms.uM01Progress.value=m01Progress(frame?.progress??0);
    uniforms.uEnabled.value=state&&(state.fire>0||state.cloudGrowth>0||state.release>0||pressure)?1:0;
    if(state){
      uniforms.uKind.value=state.kind;
      for(const name of vectorNames){const key=name[0].toLowerCase()+name.slice(1);uniforms['u'+name].value.copy(state[key]);}
      for(const name of ['Time','Radius','NozzleRadius','VisualHeight','JetLength','Fire','Release','CloudGrowth','Front','VentFire','Dissipation','Smoke','Visibility','PressureProgress']){const key=name[0].toLowerCase()+name.slice(1);uniforms['u'+name].value=state[key];}
      uniforms.uAssisted.value=state.assisted?1:0;uniforms.uMethanol.value=state.methanol?1:0;uniforms.uPressure.value=pressure?1:0;
    }
    uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);camera.getWorldPosition(uniforms.uCamera.value);
    const saved=renderer.getRenderTarget(),savedAuto=renderer.autoClear;renderer.autoClear=true;
    try{
      renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      quad.material=rayMaterial;renderer.setRenderTarget(volumeTarget);renderer.render(quadScene,camera2d);
      quad.material=compositeMaterial;renderer.setRenderTarget(saved);renderer.render(quadScene,camera2d);renders++;
    }finally{renderer.setRenderTarget(saved);renderer.autoClear=savedAuto;}
  }
  return {render,resize,setQuality,get state(){return state;},stats(){return {renderer:'webgl2-density-emission-raymarch',quality,raySteps:QUALITY_PROFILES[quality].steps,volumeResolution:[volumeWidth,volumeHeight],sceneResolution:[width,height],activeRenderTargets:disposed?0:2,noiseBytes:noise.bytes,depthTermination:true,volumeRenders:renders,targetResizes:resizes,floatTargets:half};},dispose(){
    if(disposed)return;disposed=true;
    sceneTarget.depthTexture.dispose();sceneTarget.texture.dispose();volumeTarget.texture.dispose();sceneTarget.dispose();volumeTarget.dispose();for(let i=0;i<3;i++)lifecycle.disposedTexture?.();
    noise.dispose();geometry.dispose();lifecycle.disposedGeometry();rayMaterial.dispose();compositeMaterial.dispose();lifecycle.disposedMaterial();lifecycle.disposedMaterial();quadScene.clear();
  }};
}

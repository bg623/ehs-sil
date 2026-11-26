/**
 * Kimi M01 visual-adapter contract. Coordinates here are ENU metres.
 * Geometry/animation is teaching art only; no inputs, calculations or review gates
 * are changed by these pure functions.
 */
const point=(x,y,z)=>({x,y,z});
const finitePositive=value=>Number.isFinite(value)&&value>0;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export const M01_PHASE_BOUNDARIES=Object.freeze([0,.12,.28,.46,.60,.86,1]);
export const M01_POOL_EDGE_FACTOR=1.12;
/**
 * Conservative prototype equipment AABB, Three.js Y-up metres, excluding Bund,
 * effects/yard/receptors. Measured with Box3 over actual Equipment meshes and
 * GPU instances: [-2.911461543,~0,-2.339999914] .. [2.339999914,5.367000001,3.1].
 * Rounded outward, including ladder cage, foundation, piping and bollards.
 */
export const M01_DEVICE_BOUNDS=Object.freeze({
  min:Object.freeze([-2.912,-.001,-2.341]),
  max:Object.freeze([2.341,5.368,3.101]),
  coordinateSpace:'Prototype Three.js Y-up metres; no Bund or accident effects',
});

/** Existing workbench has six equal-width stages; supplier art has six unequal ones. */
export function m01Progress(progress){
  const p=clamp(Number.isFinite(progress)?progress:0,0,1);
  if(p===1)return 1;
  const scaled=p*6,index=Math.min(5,Math.floor(scaled));
  return M01_PHASE_BOUNDARIES[index]+(M01_PHASE_BOUNDARIES[index+1]-M01_PHASE_BOUNDARIES[index])*(scaled-index);
}

/** Derive visual-only fit. Never reduce the requested pool radius to force a fit. */
export function deriveM01Layout(equipment,poolRadius){
  const g=equipment?.geometry||{},c=equipment?.containment||{},
    d=g.diameterM,h=g.heightM,length=c.lengthM,width=c.widthM,height=c.heightM;
  const fail=reason=>({valid:false,reason,anchors:null,poolCenter:null,leak:null,scales:null});
  if(![d,h,length,width,height,poolRadius].every(finitePositive))return fail('M01需要明确且大于零的设备、围堰与液池尺寸。');
  if(d>100||h>100||length>1000||width>1000||height>100)return fail('当前尺寸超出M01教学几何适配范围，使用原通用模型。');
  const sourceOrigin=equipment.anchors?.tank;
  const origin=sourceOrigin&&['x','y','z'].every(k=>Number.isFinite(sourceOrigin[k]))?point(sourceOrigin.x,sourceOrigin.y,sourceOrigin.z):point(0,0,0);
  const horizontal=d/4,vertical=h/4,edgeRadius=poolRadius*M01_POOL_EDGE_FACTOR,margin=.03,
    maxX=length/2-edgeRadius-margin,maxZ=width/2-edgeRadius-margin;
  // The wet surface is above the floor to avoid z-fighting. A very short user
  // tank must not turn the supplier's gravity stream into an uphill release.
  if(.72*vertical<=.035+.025+margin)
    return fail('当前设备过低，M01无法在液池面上方连续展示向下液流；未修改输入，使用原通用模型。');
  const deviceBounds={
    min:M01_DEVICE_BOUNDS.min.map((value,index)=>value*(index===1?vertical:horizontal)),
    max:M01_DEVICE_BOUNDS.max.map((value,index)=>value*(index===1?vertical:horizontal)),
  };
  if(deviceBounds.min[0]<-length/2+margin||deviceBounds.max[0]>length/2-margin||
    deviceBounds.min[2]<-width/2+margin||deviceBounds.max[2]>width/2-margin)
    return fail('当前围堰无法容纳M01完整设备、梯笼或阀后短管；未缩放或修改输入，使用原通用模型。');
  if(maxX<=0||maxZ<=0)return fail('当前液池无法在围堰内完整展示，未缩小输入半径；使用原通用模型。');
  const foundationRadius=2.34*horizontal,minCenterDistance=foundationRadius+edgeRadius+margin;
  let x=clamp(.9*horizontal,-maxX,maxX),z=clamp(4*horizontal,-maxZ,maxZ);
  if(Math.hypot(x,z)<minCenterDistance){
    const neededX=Math.sqrt(Math.max(0,minCenterDistance**2-z**2));
    if(neededX<=maxX)x=Math.max(x,neededX);
    else {
      x=maxX;
      const neededZ=Math.sqrt(Math.max(0,minCenterDistance**2-x**2));
      if(neededZ>maxZ)return fail('当前围堰中没有同时避开罐基础和围堰墙的M01液池位置；使用原通用模型。');
      z=Math.max(z,neededZ);
    }
  }
  const enu=([px,py,pz])=>point(origin.x+px,origin.y-pz,origin.z+py);
  const tank=point(origin.x,origin.y,origin.z),tankBase=enu([0,.22*vertical,0]),
    outlet=enu([.9*horizontal,.72*vertical,2.08*horizontal]),
    rootValve=enu([.9*horizontal,.72*vertical,2.35*horizontal]),
    leak=enu([.9*horizontal,.72*vertical,3.08*horizontal]),poolCenter=enu([x,.035,z]);
  return {valid:true,reason:'M01教学外观适配；液池按用户半径保留并在围堰内避让罐基础。',
    origin,anchors:{tank,tankBase,outlet,rootValve,leak,poolCenter},poolCenter,leak,
    scales:{tank:[horizontal,vertical,horizontal],bund:[length/12,height,width/10]},
    dimensions:{diameterM:d,heightM:h,bundLengthM:length,bundWidthM:width,bundHeightM:height},
    poolRadius,edgeRadius,foundationRadius,margin,deviceBounds,
    relocated:Math.abs(x-.9*horizontal)>1e-9||Math.abs(z-4*horizontal)>1e-9,
    coordinateSpace:'ENU metres; x=east,y=north,z=up; visual layout only'};
}

/** Deliberately narrow: do not present methanol art as another material or mechanism. */
export function isM01Candidate(spec){
  if(!spec?.support?.canPlayDetailedStoryboard||spec.sceneId!=='pool-fire')return false;
  if(spec.material?.id!=='methanol'||spec.material.composition!=='pure'||spec.material.state!=='liquid')return false;
  const equipment=spec.equipment;
  if(equipment?.geometry?.orientation!=='vertical'||equipment.leakAnchor!=='valve-downstream')return false;
  if(spec.process?.geometryKind&&spec.process.geometryKind!=='tank')return false;
  return true;
}

export function shouldUseM01(spec){
  return isM01Candidate(spec)&&deriveM01Layout(spec.equipment,spec.pool?.radiusM).valid;
}

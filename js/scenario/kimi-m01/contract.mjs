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
    poolRadius,edgeRadius,foundationRadius,margin,
    relocated:Math.abs(x-.9*horizontal)>1e-9||Math.abs(z-4*horizontal)>1e-9,
    coordinateSpace:'ENU metres; x=east,y=north,z=up; visual layout only'};
}

/** Deliberately narrow: do not present methanol art as another material or mechanism. */
export function shouldUseM01(spec){
  if(!spec?.support?.canPlayDetailedStoryboard||spec.sceneId!=='pool-fire')return false;
  if(spec.material?.id!=='methanol'||spec.material.composition!=='pure'||spec.material.state!=='liquid')return false;
  const equipment=spec.equipment;
  if(equipment?.geometry?.orientation!=='vertical'||equipment.leakAnchor!=='valve-downstream')return false;
  if(spec.process?.geometryKind&&spec.process.geometryKind!=='tank')return false;
  return deriveM01Layout(equipment,spec.pool?.radiusM).valid;
}

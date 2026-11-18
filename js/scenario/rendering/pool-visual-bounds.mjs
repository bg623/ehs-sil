// Shared artistic support, not a source term, plume model or consequence bound.
export const POOL_VISUAL = Object.freeze({
  heightPerRadius:3.9, normalizedHeightMax:1.7, rootLiftM:.07,
  baseRadius:1.04, baseOuterFactor:1.32,
  curlAmplitude:.9, noiseOffsetMax:.5, windAmplitude:.35,
  smokeRadiusBase:1.25, smokeRadiusGrowth:.4,
  lobeOffset:.48, lobeTaper:.2, lobeCurl:.34,
  lobeWidthMax:.51, lobeOuterFactor:1.1,
});
const {heightPerRadius,normalizedHeightMax,rootLiftM,baseRadius,baseOuterFactor,curlAmplitude,noiseOffsetMax,windAmplitude,smokeRadiusBase,smokeRadiusGrowth}=POOL_VISUAL;

export function poolVisualHeight(radius){return radius*heightPerRadius;}
/** Support before deterministic wind displacement; conservative on each XY axis. */
export function poolLateralSupport(radius,h){
  return radius*(Math.max(baseRadius*baseOuterFactor,smokeRadiusBase+h*smokeRadiusGrowth)+noiseOffsetMax*curlAmplitude*h);
}
export function poolVisualBounds(radius,center,wind={x:1,y:0,z:0}){
  if(!Number.isFinite(radius)||radius<=0||![center?.x,center?.y,center?.z,wind?.x,wind?.y].every(Number.isFinite))throw Error('池火视觉域参数无效');
  const h=normalizedHeightMax,half=poolLateralSupport(radius,h),margin=Math.max(.25,radius*.15),
    dx=wind.x*windAmplitude*h*h,dy=wind.y*windAmplitude*h*h,
    rootZ=center.z+rootLiftM;
  return {
    min:{x:center.x-half+Math.min(0,dx)-margin,y:center.y-half+Math.min(0,dy)-margin,z:Math.min(0,rootZ)},
    max:{x:center.x+half+Math.max(0,dx)+margin,y:center.y+half+Math.max(0,dy)+margin,z:Math.max(7,rootZ+poolVisualHeight(radius)*h+margin)},
  };
}

// Proof of the shader's cheap support rejection:
// On EACH radial-frame axis base <=1.04*1.32r; each lobe projection
// <=r(1.041+.074h)<=1.1668r for h<=1.7. This is an axis bound, not
// a claim that the 2D curl norm is <=.5; its per-component bound is .5.
// Smoke <=r(1.25+.4h). Noise is R8 linear interpolation in [0,1], so
// |curl|<=.5. The triangle inequality adds at most .5*.9*r*h per axis.
// Outside that support BOTH density channels are zero for every noise sample;
// heat alone contributes no absorption or emission. This is not an approximation.
const gl=(x)=>Number(x).toFixed(8);
export const poolLateralSupportGlsl=`uRadius * (max(${gl(baseRadius)} * ${gl(baseOuterFactor)}, ${gl(smokeRadiusBase)} + h * ${gl(smokeRadiusGrowth)}) + ${gl(noiseOffsetMax)} * ${gl(curlAmplitude)} * h)`;

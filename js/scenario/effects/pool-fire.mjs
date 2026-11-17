// A procedural three-dimensional visual field, not a combustion calculation.
import { POOL_VISUAL as P, poolLateralSupportGlsl } from '../rendering/pool-visual-bounds.mjs';
export const poolFireField = `
Field poolFire(vec3 p) {
  Field f = emptyField();
  vec3 q = p - uRoot;
  float H = uVisualHeight;
  float h = q.y / H;
  if (h < 0.0 || h > ${P.normalizedHeightMax}) return f;
  vec2 windDisplacement = uWind.xz * h * h * ${P.windAmplitude};
  float lateralSupport = ${poolLateralSupportGlsl};
  if (any(greaterThan(abs(q.xz - windDisplacement), vec2(lateralSupport + .0001)))) return f;
  vec3 flow = q * vec3(1.35, .55, 1.35) - vec3(0.0, uTime * 1.5, 0.0);
  float broad = fbm(flow * 1.6);
  vec2 curl = vec2(noise3(flow * .7 + 13.0), noise3(flow * .7 + 39.0)) - .5;
  vec2 radial = q.xz - curl * uRadius * h * ${P.curlAmplitude} - windDisplacement;
  float plumeRadius = uRadius * mix(.12, 1.0, uFront) * mix(${P.baseRadius}, .14, min(h, 1.0));
  float envelope = 1.0 - smoothstep(plumeRadius * .62, plumeRadius * ${P.baseOuterFactor}, length(radial));
  float lobes = 0.0;
  for (int i=0; i<5; i++) {
    float fi=float(i),angle=fi*2.39996;
    float stemHeight=.74+.25*sin(fi*1.72+1.0);
    vec2 stem=vec2(cos(angle),sin(angle))*uRadius*${P.lobeOffset}*(1.0-h*${P.lobeTaper});
    stem+=curl*uRadius*h*${P.lobeCurl};
    float width=uRadius*mix(${P.lobeWidthMax},.08,min(1.0,h/stemHeight));
    float lobe=(1.0-smoothstep(width*.45,width*${P.lobeOuterFactor},length(radial-stem)))*(1.0-smoothstep(stemHeight*.78,stemHeight,h));
    lobes=max(lobes,lobe);
  }
  envelope=mix(envelope,lobes,smoothstep(.12,.48,h));
  float rootMask = 1.0 - smoothstep(uRadius * .84, uRadius * 1.02, length(q.xz));
  float ignitedRadius = uRadius * mix(.08, 1.2, uFront);
  float ignitionMask = 1.0 - smoothstep(ignitedRadius * .78, ignitedRadius, length(q.xz));
  float detail = fbm(flow * 3.7 + broad * 1.2);
  float tongue = smoothstep(.24 + h * .20, .69, broad + envelope * .20);
  tongue *= mix(.28, 1.65, smoothstep(.25, .66, detail));
  float body = envelope * tongue * (1.0 - smoothstep(.72, 1.1, h));
  body *= mix(rootMask * ignitionMask, 1.0, smoothstep(.03, .24, h));
  f.fire = body * uFire;
  f.heat = clamp(body + .35 * (1.0 - h), 0.0, 1.0);
  float smokeEnvelope = 1.0 - smoothstep(uRadius * .4, uRadius * (${P.smokeRadiusBase} + h * ${P.smokeRadiusGrowth}), length(radial));
  f.smoke = uSmoke * uFire * smokeEnvelope * smoothstep(.55, .95, h) * (1.0 - smoothstep(1.2, ${P.normalizedHeightMax}, h)) * broad * .6;
  return f;
}`;

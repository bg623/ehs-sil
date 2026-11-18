export const jetFireField = `
Field jetFire(vec3 p) {
  Field f = emptyField();
  vec3 q = p - uNozzle;
  float axial = dot(q, uDirection);
  float lengthRatio = axial / uJetLength;
  if (lengthRatio < 0.0 || lengthRatio > 1.2) return f;
  vec3 centerline = uDirection * axial + vec3(0.0, lengthRatio * lengthRatio * 1.15, 0.0);
  vec3 crossSection = q - centerline;
  float eddy = fbm(q * 2.2 - uDirection * uTime * 3.4 + vec3(0.0, -uTime, 0.0));
  vec3 bend=vec3(noise3(q*1.8-uDirection*uTime*1.9+9.)-.5,noise3(q*1.8-uDirection*uTime*2.1+27.)-.5,noise3(q*1.8-uDirection*uTime*1.7+43.)-.5);
  bend-=uDirection*dot(bend,uDirection);crossSection-=bend*lengthRatio*.55;
  float width = mix(uNozzleRadius * 1.35, .68, smoothstep(0.0, 1.0, lengthRatio));
  width *= .72 + eddy * .75;
  float body = 1.0 - smoothstep(width * .45, width * 1.18, length(crossSection));
  body *= 1.0 - smoothstep(.74, 1.18, lengthRatio);
  body *= smoothstep(.18, .64, eddy + (1.0 - lengthRatio) * .25);
  body *= mix(.28,1.65,smoothstep(.25,.65,fbm(q*4.5-uDirection*uTime*4.8)));
  float core = (1.0 - smoothstep(.04, .16, lengthRatio)) * exp(-pow(length(crossSection) / max(.025, uNozzleRadius), 2.0));
  f.fire = max(body, core * .8) * uFire;
  f.gas = body * uRelease * (1.0 - uFire) * .18;
  f.heat = clamp((1.0 - lengthRatio) * .85 + body * .3, 0.0, 1.0);
  f.smoke = uSmoke * body * smoothstep(.58, 1.0, lengthRatio) * uFire * .18;
  return f;
}`;

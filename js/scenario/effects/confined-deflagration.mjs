export const confinedDeflagrationField = `
Field confinedDeflagration(vec3 p) {
  Field f = emptyField();
  vec3 inner = min(p - uEnclosureMin, uEnclosureMax - p);
  float interior = smoothstep(-.03, .12, min(inner.x, min(inner.y, inner.z)));
  vec3 flow=p*vec3(2.7,1.15,2.7)-vec3(0.0,uTime*1.6,uTime*.2);
  float n = fbm(flow);
  float detail=fbm(flow*2.8+vec3(n*1.1,0.,n*.9));
  float travel = distance(p, uIgnition);
  float front = uFront * length(uEnclosureMax - uEnclosureMin) * 1.4;
  float burning = 1.0 - smoothstep(front - .32, front + .3, travel + (n - .5) * .3);
  float tongues=smoothstep(.43,.71,n+detail*.08)*mix(.10,1.8,smoothstep(.3,.7,detail));
  f.fire = interior * burning * uFire * tongues;
  f.gas = interior * uCloudGrowth * (1.0 - burning * uFire) * .3;
  f.heat = clamp(tongues*.5+n*.5,0.,1.);
  vec3 q = p - uVent;
  float axial = dot(q, uVentDirection);
  float reach = 3.8;
  float s = axial / reach;
  if (s > 0.0 && s < 1.2) {
    vec3 path = uVentDirection * axial + vec3(0.0, s * s * 1.0, 0.0);
    float width = (.3 + s * .62) * (.65 + n * .65);
    float ventBody = (1.0 - smoothstep(width * .42, width, length(q - path))) * (1.0 - smoothstep(.72, 1.15, s));
    ventBody*=smoothstep(.24,.66,fbm(q*2.8-uVentDirection*uTime*2.4));
    f.fire += ventBody * uVentFire * (.65 + n * .7);
    f.smoke += ventBody * uVentFire * s * .07;
  }
  f.fire *= 1.0 - uDissipation;
  f.gas *= 1.0 - uDissipation;
  return f;
}`;

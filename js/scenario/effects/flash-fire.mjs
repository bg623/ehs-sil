export const flashFireField = `
float cloudMask(vec3 p) {
  vec3 q = (p - uCloudCenter) / max(uCloudRadii * max(.08, uCloudGrowth), vec3(.05));
  q.xz -= uWind.xz * uTime * .025;
  float lumps = fbm(p * 1.5 - uWind * uTime * .15 + vec3(0.0, -uTime * .13, 0.0));
  return (1.0 - smoothstep(.65, 1.16, length(q))) * smoothstep(.2, .7, lumps + .15) * (1.0 - uDissipation);
}
Field flashFire(vec3 p) {
  Field f = emptyField();
  float mask = cloudMask(p);
  float reach = length(uCloudRadii) * 2.4;
  float travel = distance(p, uIgnition);
  float front = uFront * reach;
  float turbulent = fbm(p * 2.6 - vec3(0.0, uTime * 1.8, 0.0));
  float band = 1.0 - smoothstep(.24, .85, abs(travel - front + (turbulent - .5) * .5));
  float unburned = smoothstep(front - .18, front + .15, travel);
  f.fire = mask * band * uFire * (1.0 + turbulent * .5);
  f.gas = mask * unburned * .38;
  f.heat = turbulent * .75;
  return f;
}`;

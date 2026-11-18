export const vceField = `
Field vaporCloudExplosion(vec3 p) {
  Field f = emptyField();
  float mask = cloudMask(p);
  vec3 q = p - uIgnition;
  float disturbedTravel = length(q * vec3(.88, 1.25, 1.1));
  disturbedTravel += sin(p.x * 2.2) * sin(p.z * 1.7) * .23;
  float reach = length(uCloudRadii) * 2.6;
  float front = reach * pow(uFront, 1.35);
  float eddies = fbm(p * 2.4 - vec3(uTime * .28, uTime * 2.2, 0.0));
  float burnBand = 1.0 - smoothstep(.4, 1.15, abs(disturbedTravel - front + (eddies - .5) * .8));
  float burned = 1.0 - smoothstep(front - .5, front, disturbedTravel);
  f.fire = mask * uFire * (burnBand * 1.5 + burned * eddies * .19);
  f.gas = mask * (1.0 - burned) * .4;
  f.smoke = mask * burned * uFire * .1 * smoothstep(uCloudCenter.y, uCloudCenter.y + 2.0, p.y);
  f.heat = clamp(burnBand * .85 + eddies * .22, 0.0, 1.0);
  if (uPressure > 0.0 && uPressureProgress >= 0.0) {
    float radius = uPressureProgress * 10.0;
    float wave = exp(-pow((length(q.xz) - radius) / .14, 2.0));
    f.aux = wave * exp(-pow((p.y - .55) / .9, 2.0)) * sin(uPressureProgress * 3.14159) * .18;
  }
  return f;
}`;

// Adapted from user-supplied Kimi M01 effects (2026-11-24). Original source is preserved in the attachment.
// Flame/ignition mesh and supplier disposal removed: opaque-depth volume and resource ownership belong to the host.
import * as THREE from 'three';
import { mulberry32, smooth } from './config.mjs';

const tempObject = new THREE.Object3D();
const tempVector = new THREE.Vector3();


function createPoolGeometry(segments = 128) {
  const positions = [0, 0, 0];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2;
    const r = 1 + 0.055 * Math.sin(a * 5 + 0.7) + 0.035 * Math.sin(a * 9 - 0.8) + 0.02 * Math.cos(a * 13);
    positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    uvs.push(0.5 + Math.cos(a) * r * 0.5, 0.5 + Math.sin(a) * r * 0.5);
    if (i < segments) indices.push(0, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createLiquidJet(start, poolCenter) {
  const end = poolCenter.clone().add(new THREE.Vector3(0, Math.min(.025,Math.max(.008,start.y*.035)), 0));
  const curve = new THREE.CatmullRomCurve3([
    start,
    start.clone().lerp(end,.25).setY(start.y*.94+end.y*.06),
    start.clone().lerp(end,.52).setY(start.y*.68+end.y*.32),
    start.clone().lerp(end,.82).setY(start.y*.20+end.y*.80),
    end,
  ]);
  const material = new THREE.ShaderMaterial({
    name: 'MethanolLiquidShader',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uReveal: { value: 0 }, uStrength: { value: 0 }, uAssist: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uReveal;
      uniform float uStrength;
      uniform float uAssist;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        if (vUv.x > uReveal || uStrength < 0.002) discard;
        float moving = 0.5 + 0.5 * sin(vUv.x * 72.0 - uTime * 13.0 + vUv.y * 6.2831);
        float edge = pow(1.0 - abs(vNormal.z), 2.0);
        vec3 natural = vec3(0.64, 0.74, 0.74);
        vec3 assisted = vec3(0.24, 0.75, 0.84);
        vec3 color = mix(natural, assisted, uAssist * 0.72) + moving * 0.12 + edge * 0.08;
        float alpha = uStrength * mix(0.46, 0.82, uAssist) * (0.72 + moving * 0.28);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 8, false), material);
  mesh.name = 'Release_LiquidJet';
  mesh.renderOrder = 4;
  return { mesh, curve, material };
}

/** Deterministic supplier liquid art only. The host owns fire, camera, clock and disposal. */
export function createEffects({leak,poolCenter,poolRadius}) {
  const start=new THREE.Vector3(...leak),center=new THREE.Vector3(...poolCenter);
  const group = new THREE.Group();
  group.name = 'AccidentEffects';

  const jet = createLiquidJet(start,center);
  group.add(jet.mesh);

  const poolGroup = new THREE.Group();
  poolGroup.name = 'Pool';
  poolGroup.position.copy(center);
  const poolGeometry = createPoolGeometry();
  const wetMaterial = new THREE.MeshPhysicalMaterial({
    name: 'MethanolWetSurface', color: 0x9fb5b3, transparent: true, opacity: 0,
    roughness: 0.14, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const pool = new THREE.Mesh(poolGeometry, wetMaterial);
  pool.name = 'Pool_WetSurface_R1p2m';
  pool.rotation.x = -Math.PI / 2;
  pool.receiveShadow = true;
  pool.renderOrder = 2;
  poolGroup.add(pool);
  const rimMaterial = new THREE.LineBasicMaterial({ color: 0x61d3df, transparent: true, opacity: 0, depthTest: true });
  const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 128 }, (_, i) => {
      const a = i / 128 * Math.PI * 2;
      const r = 1 + 0.055 * Math.sin(a * 5 + 0.7) + 0.035 * Math.sin(a * 9 - 0.8) + 0.02 * Math.cos(a * 13);
      return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.008);
    }),
  ), rimMaterial);
  rim.name = 'Pool_TeachingOutline';
  rim.rotation.x = -Math.PI / 2;
  rim.renderOrder = 3;
  poolGroup.add(rim);
  group.add(poolGroup);

  const random = mulberry32(99117);
  const dropCount = 38;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 5), new THREE.MeshStandardMaterial({ color: 0x9ed6db, transparent: true, opacity: 0.72, roughness: 0.16 }), dropCount);
  drops.name = 'Release_Droplets';
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  const dropData = Array.from({ length: dropCount }, () => ({ phase: random(), side: random() - 0.5, size: 0.55 + random() * 0.85 }));
  group.add(drops);

  const splashCount = 24;
  const splashes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), drops.material, splashCount);
  splashes.name = 'Release_LandingSplashes';
  splashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  splashes.frustumCulled = false;
  const splashData = Array.from({ length: splashCount }, () => ({ phase: random(), angle: random() * Math.PI * 2, reach: 0.10 + random() * 0.20 }));
  group.add(splashes);

  let assisted = true;
  function sample(p) {
    const reveal = smooth(0.12, 0.205, p);
    const flow = smooth(0.12, 0.16, p) * (1 - smooth(0.885, 0.985, p));
    const poolGrowth = smooth(0.245, 0.50, p);
    const residual = 1 - smooth(0.91, 1.0, p) * 0.58;
    const spread = smooth(0.46, 0.605, p);
    const growth = smooth(0.475, 0.72, p) * (1 - smooth(0.87, 1.0, p) * 0.83);
    const life = smooth(0.46, 0.52, p) * (1 - smooth(0.875, 1.0, p) * 0.92);
    const effectTime = p * 18;

    jet.material.uniforms.uTime.value = effectTime;
    jet.material.uniforms.uReveal.value = reveal;
    jet.material.uniforms.uStrength.value = flow;
    jet.material.uniforms.uAssist.value = assisted ? 1 : 0;
    jet.mesh.visible = flow > 0.002;

    const scale = Math.max(0.001, poolRadius * poolGrowth);
    poolGroup.scale.set(scale, 1, scale);
    poolGroup.visible = poolGrowth > 0.001;
    wetMaterial.opacity = poolGrowth * residual * (assisted ? 0.32 : 0.23);
    wetMaterial.color.setHex(assisted ? 0xa3b8b5 : 0xa9b4b0);
    rimMaterial.opacity = assisted ? poolGrowth * residual * 0.72 : 0;

    drops.visible = flow > 0.02;
    drops.material.opacity = assisted ? 0.82 : 0.46;
    for (let i = 0; i < dropCount; i++) {
      const data = dropData[i];
      const f = (data.phase + p * 8.0) % 1;
      jet.curve.getPoint(f, tempVector);
      tempVector.x += data.side * 0.07 * f;
      tempVector.z += Math.sin(f * Math.PI) * data.side * 0.06;
      tempObject.position.copy(tempVector);
      tempObject.scale.setScalar((f<=reveal?1:0) * data.size * flow * smooth(0.0, 0.12, f));
      tempObject.updateMatrix();
      drops.setMatrixAt(i, tempObject.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;

    splashes.visible = flow > 0.05 && reveal > 0.985;
    for (let i = 0; i < splashCount; i++) {
      const data = splashData[i];
      const f = (data.phase + p * 10.0) % 1;
      const reach = data.reach * f;
      tempObject.position.set(center.x + Math.cos(data.angle) * reach, center.y + 0.025 + Math.sin(f * Math.PI) * 0.12, center.z + Math.sin(data.angle) * reach);
      tempObject.scale.setScalar((1 - f) * flow);
      tempObject.updateMatrix();
      splashes.setMatrixAt(i, tempObject.matrix);
    }
    splashes.instanceMatrix.needsUpdate = true;
  }

  return {group,sample,setAssisted(value){assisted=Boolean(value);}};
}


import * as THREE from 'three';
import { worldToThree } from '../coordinates.mjs';

const position = (p) => new THREE.Vector3(...worldToThree(p));
const shift = (p, x = 0, y = 0, z = 0) => ({ x: p.x + x, y: p.y + y, z: p.z + z });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;

// Geometry and artistic appearance only. No source-term or consequence equations.
export function createSceneAssembly(spec, lifecycle) {
  const group = new THREE.Group(), geometries = new Set(), materials = new Set();
  const materialCache = new Map();
  const geometry = (g) => { geometries.add(g); lifecycle.createdGeometry(); return g; };
  const material = (m) => { materials.add(m); lifecycle.createdMaterial(); return m; };
  function standard(key, color, extras = {}) {
    if (!materialCache.has(key)) materialCache.set(key, material(new THREE.MeshStandardMaterial({ color, roughness: .64, metalness: .16, ...extras })));
    return materialCache.get(key);
  }
  const steel = standard('steel', 0x617c76, { metalness: .48, roughness: .46 });
  const paleSteel = standard('pale-steel', 0xc0d1c9, { metalness: .26, roughness: .48 });
  const green = standard('green', 0x37655b), concrete = standard('concrete', 0xc3cec7);
  const water = standard('teaching-liquid', 0x7db9cc, { transparent: true, opacity: .56, metalness: .03 });
  const accent = standard('accent', 0xc6a465, { metalness: .36 });
  const pointMaterial = standard('receptor', 0x0d473f);
  function mesh(g, m, p, parent = group) {
    const object = new THREE.Mesh(geometry(g), m); object.position.copy(position(p)); parent.add(object); return object;
  }
  function pipe(a, b, radius = .065, m = steel) {
    const aa = position(a), bb = position(b), vector = bb.clone().sub(aa), length = vector.length();
    if (length < .00001) return null;
    const object = new THREE.Mesh(geometry(new THREE.CylinderGeometry(radius, radius, length, 10)), m);
    object.position.copy(aa.add(bb).multiplyScalar(.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());group.add(object);return object;
  }
  const eq = spec.equipment, { diameterM: d, heightM: h } = eq.geometry, r = d / 2;
  if (![d, h].every((n) => Number.isFinite(n) && n > 0 && n < 1000)) throw Error('设备示意尺寸无效');
  const anchors = eq.anchors, origin = anchors.tank;
  const { lengthM: length, widthM: width, heightM: wallHeight } = eq.containment;
  const horizontal = eq.geometry.orientation === 'horizontal';
  const labels = [];

  function createContainment() {
    const ground = mesh(new THREE.PlaneGeometry(length + 3, width + 3), standard('ground', 0xe3eae5), shift(origin, 0, 0, -.09));ground.rotation.x = -Math.PI / 2;
    const yard = mesh(new THREE.PlaneGeometry(length - .1, width - .1), standard('yard', 0xd7e0d8), shift(origin, 0, 0, -.035));yard.rotation.x = -Math.PI / 2;
    for (const [x, y, a, b] of [[0, width / 2, length + .18, .18], [0, -width / 2, length + .18, .18], [-length / 2, 0, .18, width], [length / 2, 0, .18, width]]) {
      mesh(new THREE.BoxGeometry(a, wallHeight, b), concrete, shift(origin, x, y, wallHeight / 2));
    }
    const drain = shift(origin, -length / 2 + .8, -width / 2, .12);
    pipe(shift(drain, 0, -.42, 0), shift(drain, 0, .32, 0), .075, steel);
    mesh(new THREE.BoxGeometry(.24, .28, .12), green, shift(drain, 0, -.1, .08));
    labels.push({ text: '示意排液关闭', point: shift(drain, 0, -.1, .35) });
    const northOrigin = shift(origin, -length / 2 + .7, -width / 2 + 1.2, .045);
    mesh(new THREE.BoxGeometry(.06, .05, 1.15), green, northOrigin);
    const arrow = mesh(new THREE.ConeGeometry(.18, .42, 3), green, shift(northOrigin, 0, .73, 0));arrow.rotation.x = -Math.PI / 2;
    labels.push({ text: 'N 北', point: shift(northOrigin, 0, 1, .15) });
  }

  function createTank() {
    const foundation = mesh(new THREE.CylinderGeometry(r + .22, r + .3, .25, 40), concrete, shift(origin, 0, 0, .04));
    foundation.userData.part = 'foundation';
    const wall = mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), standard('tank-wall', 0x9cb7a9, { transparent: true, opacity: .87, side: THREE.DoubleSide }), shift(origin, 0, 0, h / 2 + .16));
    const bottom = mesh(new THREE.CylinderGeometry(r, r, .12, 40), paleSteel, shift(origin, 0, 0, .17));
    let liquid, liquidGauge;
    if (horizontal) {
      wall.rotation.z = Math.PI / 2;bottom.rotation.z = Math.PI / 2;
      wall.position.copy(position(shift(origin, 0, 0, r + .36)));bottom.position.copy(position(shift(origin, -h / 2, 0, r + .36)));
      const end = mesh(new THREE.CylinderGeometry(r, r, .12, 40), paleSteel, shift(origin, h / 2, 0, r + .36));end.rotation.z = Math.PI / 2;
      for (const x of [-h * .3, h * .3]) mesh(new THREE.BoxGeometry(.4, .45, d * .8), concrete, shift(origin, x, 0, .2));
    } else {
      const roof = mesh(new THREE.ConeGeometry(r + .07, Math.max(.25, r * .15), 48), paleSteel, shift(origin, 0, 0, h + .16 + Math.max(.25, r * .15) / 2));
      roof.userData.part = 'fixed-roof';
      for (const level of [.2, h * .42, h * .83, h + .1]) {
        const ring = mesh(new THREE.TorusGeometry(r + .025, .035, 6, 48), steel, shift(origin, 0, 0, level + .16));ring.rotation.x = Math.PI / 2;
      }
      const railHeight = h + .8;
      const rail = mesh(new THREE.TorusGeometry(r * .88, .025, 5, 40), steel, shift(origin, 0, 0, railHeight));rail.rotation.x = Math.PI / 2;
      for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10;pipe(shift(origin, Math.cos(a) * r * .88, Math.sin(a) * r * .88, h + .25), shift(origin, Math.cos(a) * r * .88, Math.sin(a) * r * .88, railHeight), .021); }
      const ladderX = -r - .16;
      for (const y of [-.25, .25]) pipe(shift(origin, ladderX, y, .3), shift(origin, ladderX, y, h + .72), .035);
      const rungs = Math.min(18, Math.ceil(h / .3));
      for (let i = 0; i < rungs; i++) pipe(shift(origin, ladderX, -.25, .4 + i * (h / rungs)), shift(origin, ladderX, .25, .4 + i * (h / rungs)), .022);
      const manhole = mesh(new THREE.CylinderGeometry(.31, .31, .12, 24), paleSteel, shift(origin, 0, -r - .03, 1));manhole.rotation.x = Math.PI / 2;
      const liquidPlane = new THREE.CircleGeometry(r * .97, 40);
      liquid = mesh(liquidPlane, water, shift(origin, 0, 0, .2));liquid.rotation.x = -Math.PI / 2;
      const gaugeBase = shift(origin, r * .58, -r * .83 - .035, .18);
      pipe(gaugeBase, shift(gaugeBase, 0, 0, h), .055, paleSteel);
      liquidGauge = mesh(new THREE.CylinderGeometry(.037, .037, 1, 8), standard('gauge-fill', 0x41859b), gaugeBase);
      liquidGauge.userData.base = gaugeBase;
    }
    labels.push({ key: 'equipment', text: eq.name, point: shift(origin, 0, 0, h + .9) });
    return { liquid, liquidGauge };
  }

  function createPiping() {
    if (!anchors.outlet || !anchors.rootValve) return { leakPath: [], leakMarker: null, valveMarker: null };
    pipe(anchors.outlet, anchors.rootValve, .105);
    if (anchors.leak) {
      pipe(anchors.rootValve, anchors.leak, .105);
      const direction = position(anchors.leak).sub(position(anchors.rootValve)).normalize().multiplyScalar(.26);
      const end = position(anchors.leak).add(direction);
      const extra = new THREE.Mesh(geometry(new THREE.CylinderGeometry(.105, .105, .26, 12)), steel);
      extra.position.copy(position(anchors.leak).add(direction.clone().multiplyScalar(.5)));
      extra.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());group.add(extra);
    }
    mesh(new THREE.SphereGeometry(.18, 12, 8), green, anchors.rootValve);
    const stem = shift(anchors.rootValve, 0, 0, .56);pipe(anchors.rootValve, stem, .035);
    const wheel = mesh(new THREE.TorusGeometry(.22, .025, 6, 18), accent, stem);wheel.rotation.x = -Math.PI / 2;
    pipe(shift(stem, -.2, 0), shift(stem, .2, 0), .015, accent);pipe(shift(stem, 0, -.2), shift(stem, 0, .2), .015, accent);
    labels.push({ text: '根部隔离阀', point: shift(stem, 0, 0, .25) });
    const valveMarker = mesh(new THREE.SphereGeometry(.3, 14, 8), standard('valve-highlight', 0xd1b874, { transparent: true, opacity: .28, wireframe: true }), anchors.rootValve);
    const leakPath = [];
    let leakMarker = null;
    if (anchors.leak && anchors.poolCenter) {
      const ground = { ...anchors.leak, z: origin.z + .035 };
      leakPath.push(pipe(anchors.leak, ground, .025, water), pipe(ground, anchors.poolCenter, .034, water));
      leakMarker = mesh(new THREE.SphereGeometry(.14, 12, 8), standard('leak-marker', 0xbe955a, { transparent: true, opacity: .92 }), anchors.leak);
      labels.push({ text: '泄漏点（教学）', point: shift(anchors.leak, 0, 0, .3), show: 'leak' });
    }
    return { leakPath: leakPath.filter(Boolean), leakMarker, valveMarker };
  }

  function createPoolFire() {
    if (!anchors.poolCenter) return null;
    const radius = spec.pool.radiusM;
    const pool = mesh(new THREE.CircleGeometry(radius, 48), water, shift(anchors.poolCenter, 0, 0, .025));pool.rotation.x = -Math.PI / 2;
    const flameGroup = new THREE.Group();flameGroup.position.copy(position(shift(anchors.poolCenter, 0, 0, .065)));group.add(flameGroup);
    const flameHeight = radius * 2.8;
    const shader = material(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x70b9ec) }, uOpacity: { value: .7 }, uAssisted: { value: 1 } },
      vertexShader: `varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vec3 p=position;float h=uv.y;float silhouette=(1.0-h)*.87+.045;float wave=sin(h*12.0-uTime*2.2)*.065*h+sin(h*23.0+uTime*1.7)*.032*h;p.x=p.x*silhouette+wave;p.z+=sin(h*8.0+uTime)*.035*h;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uAssisted;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        void main(){
          float h=vUv.y;
          float side=abs(vUv.x*2.0-1.0);
          float n=noise(vec2(vUv.x*8.0,h*10.0-uTime*1.35));
          float ed=1.0-smoothstep(.55,.98,side);
          float tip=1.0-smoothstep(.68,1.0,h);
          float alpha=ed*tip*(.38+.62*n)*uOpacity;
          float contour=(1.0-smoothstep(.04,.12,abs(side-.72)))*uAssisted*.16;
          alpha=max(alpha,contour*tip);
          vec3 c=mix(uColor,vec3(.75,.87,1.0),(1.0-side)*.34);
          gl_FragColor=vec4(c,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    const flameGeometry = geometry(new THREE.PlaneGeometry(radius * 2, flameHeight, 14, 34));
    const layers = [];
    for (let i = 0; i < 3; i++) { const layer = new THREE.Mesh(flameGeometry, shader);layer.rotation.y = i * Math.PI / 3;layer.position.y = flameHeight / 2;flameGroup.add(layer);layers.push(layer); }
    labels.push({ text: '预设液池 / 火焰根部', point: shift(anchors.poolCenter, 0, 0, .18), show: 'pool' });
    return { pool, flameGroup, shader, flameHeight, layers };
  }

  createContainment();const tank = createTank(), piping = createPiping(), fire = createPoolFire();
  const receptors = new THREE.Group();group.add(receptors);
  const receptorGeometry = geometry(new THREE.SphereGeometry(.12, 10, 6));
  let receptorSignature = '';

  return {
    group, labels,
    update(current, frame) {
      labels.find((entry) => entry.key === 'equipment').text = current.equipment.name;
      const level = current.equipment.liquidLevelM;
      if (tank.liquid) {tank.liquid.visible = Number.isFinite(level);if (Number.isFinite(level)) tank.liquid.position.copy(position(shift(origin, 0, 0, .18 + clamp(level, 0, h))));}
      if (tank.liquidGauge) {tank.liquidGauge.visible = Number.isFinite(level) && level > 0;if (Number.isFinite(level)) {const height = clamp(level, 0, h);tank.liquidGauge.scale.y = height;tank.liquidGauge.position.copy(position(shift(tank.liquidGauge.userData.base, 0, 0, height / 2)));}}
      for (const object of piping.leakPath) object.visible = frame.leakVisible === true;
      if (piping.leakMarker) {piping.leakMarker.visible = frame.leakVisible === true;piping.leakMarker.scale.setScalar(1 + .06 * Math.sin(finite(frame.noiseTime, 0) * 2));}
      if (piping.valveMarker) piping.valveMarker.visible = frame.highlight === 'controls' || frame.highlight === 'rootValve' || frame.stage === 4;
      if (fire) {
        fire.pool.visible = frame.poolVisible === true;const scale = clamp(finite(frame.poolScale, 1), .03, 1);fire.pool.scale.set(scale, scale, 1);
        fire.flameGroup.visible = frame.fireVisible === true && current.support.canPlayDetailedStoryboard;
        const growth = clamp(finite(frame.fireGrowth, 1), .02, 1);fire.flameGroup.scale.y = growth;
        const profile = current.visual.profile || {}, pure = current.material.composition === 'pure';
        fire.shader.uniforms.uColor.value.set(pure && /^#[0-9a-f]{6}$/i.test(profile.color) ? profile.color : '#a6b8bd');
        fire.shader.uniforms.uOpacity.value = pure ? clamp(finite(current.visual.mode === 'natural' ? profile.naturalOpacity : profile.assistedOpacity, .5), .04, .95) : .52;
        fire.shader.uniforms.uAssisted.value = current.visual.mode === 'natural' ? 0 : 1;
        fire.shader.uniforms.uTime.value = finite(frame.noiseTime, 0);
      }
      const nextSignature = JSON.stringify(current.receptors || []);
      if (nextSignature !== receptorSignature) {receptorSignature = nextSignature;receptors.clear();for (const r of current.receptors || []) {const marker = new THREE.Mesh(receptorGeometry, pointMaterial);marker.position.copy(position(r));receptors.add(marker);}}
    },
    dispose() {
      group.removeFromParent();group.clear();
      for (const g of geometries) {g.dispose();lifecycle.disposedGeometry();}
      for (const m of materials) {m.dispose();lifecycle.disposedMaterial();}
      geometries.clear();materials.clear();
    },
  };
}

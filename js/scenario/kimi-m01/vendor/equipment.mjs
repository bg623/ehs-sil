// Adapted from user-supplied Kimi M01 source (2026-11-24); original attachment retained read-only.
import * as THREE from 'three';
import { ANCHORS, BUND, TANK } from './config.mjs';
import { makeTextTexture } from './materials.mjs';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// A downstream release needs an actual opening, not the supplier's solid disc
// end-cap. Extruded annuli keep the same outer envelope and named anchors.
function annularGeometry(outer,inner,length,segments=24){
  const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);
  const opening=new THREE.Path();opening.absarc(0,0,inner,0,Math.PI*2,true);
  shape.holes.push(opening);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:length,steps:1,bevelEnabled:false,curveSegments:segments});
  geometry.translate(0,0,-length/2);
  return geometry;
}

function finish(mesh, name, shadows = true) {
  mesh.name = name;
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

function box(group, name, size, position, material) {
  const mesh = finish(new THREE.Mesh(new THREE.BoxGeometry(...size), material), name);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function cylinder(group, name, radius, height, position, material, segments = 48) {
  const mesh = finish(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material), name);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}

function pipeBetween(group, name, start, end, radius, material, segments = 16) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const geometry=name==='DownstreamShortPipe'
    ?annularGeometry(radius,radius*.76,direction.length(),segments).rotateX(-Math.PI/2)
    :new THREE.CylinderGeometry(radius, radius, direction.length(), segments);
  const mesh = finish(new THREE.Mesh(geometry, material), name);
  if(name==='DownstreamShortPipe')mesh.userData.openOutlet=true;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  group.add(mesh);
  return mesh;
}

function torus(group, name, radius, tube, position, material, rotation = [Math.PI / 2, 0, 0], arc = Math.PI * 2) {
  const mesh = finish(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48, arc), material), name);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function createRailing(group, materials) {
  const railing = new THREE.Group();
  railing.name = 'RoofRailing';
  const roofY = TANK.baseY + TANK.height + 0.34;
  const railRadius = 1.91;
  torus(railing, 'TopRail', railRadius, 0.027, [0, roofY + 0.78, 0], materials.steel);
  torus(railing, 'MidRail', railRadius, 0.022, [0, roofY + 0.39, 0], materials.steel);
  torus(railing, 'ToeBoard', railRadius, 0.045, [0, roofY + 0.08, 0], materials.darkSteel);
  const count = 24;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.8, 8), materials.steel, count);
  posts.name = 'RailingPosts';
  posts.castShadow = true;
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    matrix.makeTranslation(Math.cos(a) * railRadius, roofY + 0.4, Math.sin(a) * railRadius);
    posts.setMatrixAt(i, matrix);
  }
  railing.add(posts);
  group.add(railing);
}

function createLadder(group, materials) {
  const ladder = new THREE.Group();
  ladder.name = 'AccessLadder';
  const x = -2.28;
  const top = 5.18;
  pipeBetween(ladder, 'LadderRail_L', [x, 0.24, -0.34], [x, top, -0.34], 0.033, materials.darkSteel);
  pipeBetween(ladder, 'LadderRail_R', [x, 0.24, 0.34], [x, top, 0.34], 0.033, materials.darkSteel);
  const rungCount = 17;
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 8), materials.steel, rungCount);
  rungs.name = 'LadderRungs';
  rungs.castShadow = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let i = 0; i < rungCount; i++) {
    matrix.compose(new THREE.Vector3(x - 0.015, 0.48 + i * 0.275, 0), quaternion, new THREE.Vector3(1, 1, 1));
    rungs.setMatrixAt(i, matrix);
  }
  ladder.add(rungs);
  for (let i = 0; i < 5; i++) {
    const cage = torus(ladder, `SafetyCage_${i}`, 0.49, 0.022, [x - 0.12, 2.25 + i * 0.58, 0], materials.steel, [Math.PI / 2, 0, 0.72], Math.PI * 1.45);
    cage.castShadow = false;
  }
  pipeBetween(ladder, 'CageStrap_A', [x - 0.52, 2.2, -0.32], [x - 0.52, 4.85, -0.32], 0.018, materials.steel, 8);
  pipeBetween(ladder, 'CageStrap_B', [x - 0.52, 2.2, 0.32], [x - 0.52, 4.85, 0.32], 0.018, materials.steel, 8);
  group.add(ladder);
}

function createValveAndPiping(group, materials) {
  const piping = new THREE.Group();
  piping.name = 'Piping';
  const valve = new THREE.Group();
  valve.name = 'Valve';
  valve.userData.description = '根部隔离阀仅作设备显示；不据此宣称隔离成功。';
  const x = 0.9, y = 0.72;
  pipeBetween(piping, 'TankOutlet', [x, y, 1.72], [x, y, 2.08], 0.095, materials.pipe, 24);
  pipeBetween(valve, 'RootValveBody', [x, y, 2.08], [x, y, 2.62], 0.14, materials.darkSteel, 24);
  pipeBetween(piping, 'DownstreamShortPipe', [x, y, 2.62], [x, y, 3.08], 0.095, materials.pipe, 24);
  for (const [index, z] of [2.05, 2.65, 3.04].entries()) {
    const flange=finish(new THREE.Mesh(annularGeometry(.19,.095,.055,16),materials.steel),`Flange_${index+1}`);
    flange.position.set(x,y,z);piping.add(flange);
    const gasket=finish(new THREE.Mesh(annularGeometry(.155,.095,.018,16),materials.rubber),`FlangeGasket_${index+1}`);
    gasket.position.set(x,y,z+.035);piping.add(gasket);
  }
  pipeBetween(valve, 'ValveStem', [x, y + 0.1, 2.35], [x, y + 0.52, 2.35], 0.033, materials.steel, 12);
  torus(valve, 'RootIsolationHandwheel', 0.24, 0.027, [x, y + 0.55, 2.35], materials.red);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    pipeBetween(valve, `HandwheelSpoke_${i}`, [x, y + 0.55, 2.35], [x + Math.cos(a) * 0.22, y + 0.55, 2.35 + Math.sin(a) * 0.22], 0.014, materials.red, 8);
  }
  const lip = torus(piping, 'LeakOutletRim', 0.098, 0.015, [x, y, 3.085], materials.darkSteel, [0, 0, 0]);
  lip.rotation.x = 0;
  group.add(piping);
  group.add(valve);
}

function createLevelGauge(group, materials) {
  const gauge = new THREE.Group();
  gauge.name = 'LevelGauge';
  const x = -1.38, z = 1.52;
  pipeBetween(gauge, 'GaugeGlass', [x, 0.45, z], [x, 4.15, z], 0.042, materials.glass, 16);
  // Unit-height geometry: the host drives the displayed fill from current
  // derived liquid level without replacing geometry or changing input values.
  cylinder(gauge, 'GaugeLiquidLevel', 0.026, 1, [x, 0.45 + .5, z], materials.gaugeLiquid, 12);
  for (const y of [0.45, 4.15]) {
    pipeBetween(gauge, `GaugeConnector_${y}`, [x, y, z - 0.12], [x, y, z + 0.12], 0.035, materials.steel, 12);
  }
  group.add(gauge);
}

export function createEquipment(materials, {plateLines=[]}={}) {
  const equipment = new THREE.Group();
  equipment.name = 'Equipment';
  equipment.userData.units = 'metres';
  equipment.userData.upAxis = '+Y';
  equipment.userData.scenario = 'M01 methanol pool fire — fixed educational geometry';

  const bund = new THREE.Group();
  bund.name = 'Bund';
  box(bund, 'BundFloor_12m_x_10m', [BUND.length + BUND.wall * 2, 0.14, BUND.width + BUND.wall * 2], [0, -0.07, 0], materials.concrete);
  box(bund, 'BundWall_West', [BUND.wall, BUND.height, BUND.width + BUND.wall * 2], [-BUND.length / 2 - BUND.wall / 2, BUND.height / 2, 0], materials.concrete);
  box(bund, 'BundWall_East', [BUND.wall, BUND.height, BUND.width + BUND.wall * 2], [BUND.length / 2 + BUND.wall / 2, BUND.height / 2, 0], materials.concrete);
  box(bund, 'BundWall_North', [BUND.length, BUND.height, BUND.wall], [0, BUND.height / 2, -BUND.width / 2 - BUND.wall / 2], materials.concrete);
  box(bund, 'BundWall_South', [BUND.length, BUND.height, BUND.wall], [0, BUND.height / 2, BUND.width / 2 + BUND.wall / 2], materials.concrete);
  equipment.add(bund);

  const tank = new THREE.Group();
  tank.name = 'Tank';
  cylinder(tank, 'TankFoundation', 2.34, TANK.baseY, [0, TANK.baseY / 2, 0], materials.concreteDark, 64);
  cylinder(tank, 'FixedRoofTankShell_D4_H4', TANK.radius, TANK.height, [0, TANK.baseY + TANK.height / 2, 0], materials.tank, 96);
  const roof = finish(new THREE.Mesh(new THREE.ConeGeometry(2.04, 0.36, 96), materials.tankRoof), 'FixedRoof');
  roof.position.y = TANK.baseY + TANK.height + 0.18;
  tank.add(roof);
  for (const [i, y] of [TANK.baseY + 0.06, 1.52, 2.86, TANK.baseY + TANK.height - 0.03].entries()) {
    torus(tank, `StiffeningRing_${i + 1}`, 2.025, i === 0 ? 0.045 : 0.032, [0, y, 0], materials.steel);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    pipeBetween(tank, `ShellWeld_${i + 1}`, [Math.cos(a) * 2.006, TANK.baseY + 0.08, Math.sin(a) * 2.006], [Math.cos(a) * 2.006, TANK.baseY + TANK.height - 0.06, Math.sin(a) * 2.006], 0.008, materials.darkSteel, 6);
  }
  const manhole = cylinder(tank, 'RoofManhole', 0.34, 0.18, [0.65, 4.55, -0.25], materials.darkSteel, 32);
  manhole.rotation.z = -0.08;
  cylinder(tank, 'RoofManholeCover', 0.4, 0.055, [0.65, 4.66, -0.25], materials.steel, 32);
  pipeBetween(tank, 'VentRiser', [-0.75, 4.42, -0.3], [-0.75, 5.02, -0.3], 0.07, materials.pipe, 16);
  pipeBetween(tank, 'VentOutlet', [-0.75, 5.02, -0.3], [-0.42, 5.02, -0.3], 0.07, materials.pipe, 16);
  createRailing(tank, materials);
  createLadder(tank, materials);
  createLevelGauge(tank, materials);

  const signTexture = makeTextTexture(plateLines);
  const signMaterial = new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.55, metalness: 0.08 });
  const sign = finish(new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.04, 0.035), signMaterial), 'TankIdentificationPlate');
  sign.position.set(0, 2.62, 2.025);
  tank.add(sign);
  equipment.add(tank);

  createValveAndPiping(equipment, materials);

  const safety = new THREE.Group();
  safety.name = 'LocalSafetyDetails';
  for (const [i, pos] of [[0, [-0.05, 0.43, 2.65]], [1, [1.85, 0.43, 2.65]]]) {
    cylinder(safety, `Bollard_${i + 1}`, 0.085, 0.86, pos, materials.yellow, 16);
    cylinder(safety, `BollardBand_${i + 1}`, 0.088, 0.16, [pos[0], 0.55, pos[2]], materials.rubber, 16);
  }
  equipment.add(safety);

  for (const [name, position] of Object.entries(ANCHORS)) {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.set(...position);
    anchor.userData.coordinateSpace = 'Equipment local; metres; +Y up; +Z toward outlet';
    equipment.add(anchor);
  }
  return equipment;
}


import * as THREE from 'three';
import {worldToThree} from '../coordinates.mjs';
import {deriveM01Layout,m01Progress,shouldUseM01} from './contract.mjs';
import {createMaterials,makeTextTexture} from './vendor/materials.mjs';
import {createEquipment} from './vendor/equipment.mjs';
import {createEffects} from './vendor/effects.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const labelOffset=(p,z)=>({x:p.x,y:p.y,z:p.z+z});
const format=v=>Number.isFinite(v)?String(Number(v.toFixed(3))):'未填写';
function plateLines(spec){
  const q=spec.quantityDerived||{},geometry=spec.equipment.geometry;
  const quantity=Number.isFinite(q.volumeM3)?`${format(q.volumeM3)} m³`:Number.isFinite(q.massKg)?`${format(q.massKg)} kg`:'库存未填写';
  const temperature=Number.isFinite(spec.material.temperatureK)?`${format(spec.material.temperatureK-273.15)}°C`:'温度未填写';
  return [
    {text:`${spec.material.name||'甲醇'}  METHANOL`,size:62,y:106},
    {text:quantity,size:78,y:235,weight:700},
    {text:`D ${format(geometry.diameterM)} m / H ${format(geometry.heightM)} m`,size:43,y:348,weight:500},
    {text:`${temperature} · 教学设备`,size:36,y:438,color:'#50676b',weight:500},
  ];
}

/**
 * Host-owned synchronous assembly: no renderer, event listeners, camera, network
 * or private animation loop. Frame.progress is its only temporal input. Kimi's
 * flame mesh is intentionally absent: the host raymarcher owns opaque-depth
 * combustion rendering and high-resolution output.
 */
export function createM01Assembly(spec,lifecycle={}){
  if(!shouldUseM01(spec))throw Error('当前条件不适用M01甲醇阀后泄漏视觉适配。');
  const layout=deriveM01Layout(spec.equipment,spec.pool.radiusM);
  const group=new THREE.Group();group.name='kimi-m01-industrial-tank';
  group.position.set(...worldToThree(layout.origin));
  const geometries=new Set(),materials=new Set(),textures=new Set(),instancedMeshes=new Set();
  const counts={createdGeometries:0,disposedGeometries:0,createdMaterials:0,disposedMaterials:0,createdTextures:0,disposedTextures:0};
  const trackGeometry=g=>{if(g&&!geometries.has(g)){geometries.add(g);counts.createdGeometries++;lifecycle.createdGeometry?.();}return g;};
  const trackTexture=t=>{if(t?.isTexture&&!textures.has(t)){textures.add(t);counts.createdTextures++;lifecycle.createdTexture?.();}return t;};
  const trackMaterial=m=>{
    if(!m||materials.has(m))return m;
    materials.add(m);counts.createdMaterials++;lifecycle.createdMaterial?.();
    for(const value of Object.values(m))if(value?.isTexture)trackTexture(value);
    return m;
  };
  const trackTree=root=>root.traverse(object=>{
    trackGeometry(object.geometry);
    if(object.isInstancedMesh)instancedMeshes.add(object);
    if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])trackMaterial(material);
  });
  const releaseTexture=texture=>{if(textures.delete(texture)){texture.dispose();counts.disposedTextures++;lifecycle.disposedTexture?.();}};
  const palette=createMaterials();for(const material of Object.values(palette))trackMaterial(material);
  let lines=plateLines(spec),plateSignature=JSON.stringify(lines);
  const equipment=createEquipment(palette,{plateLines:lines});
  equipment.scale.set(...layout.scales.tank);group.add(equipment);
  const bund=equipment.getObjectByName('Bund');
  equipment.remove(bund);bund.scale.set(...layout.scales.bund);group.add(bund);
  const localYup=point=>worldToThree({x:point.x-layout.origin.x,y:point.y-layout.origin.y,z:point.z-layout.origin.z});
  // Pool is repositioned to fit real input containment, so unlike tank anchors it
  // must not inherit the tank model's nonuniform scale a second time.
  const poolAnchor=equipment.getObjectByName('Anchor_Pool');
  equipment.remove(poolAnchor);poolAnchor.position.set(...localYup(layout.poolCenter));group.add(poolAnchor);
  const effects=createEffects({leak:localYup(layout.leak),poolCenter:localYup(layout.poolCenter),poolRadius:layout.poolRadius});
  group.add(effects.group);
  const yardSize=[Math.max(18,layout.dimensions.bundLengthM+6),Math.max(15,layout.dimensions.bundWidthM+6)];
  const yard=new THREE.Mesh(new THREE.BoxGeometry(yardSize[0],.12,yardSize[1]),palette.asphalt);
  yard.name='M01_SiteGround';yard.position.y=-.14*layout.scales.bund[1]-.06;yard.receiveShadow=true;group.add(yard);
  const receptorGeometry=new THREE.SphereGeometry(.10,10,7),receptors=new THREE.InstancedMesh(receptorGeometry,palette.yellow,64);
  receptors.name='M01_Receptors';receptors.count=0;receptors.castShadow=true;group.add(receptors);
  const receptorTransform=new THREE.Matrix4();
  trackTree(group);
  const liquidGauge=equipment.getObjectByName('GaugeLiquidLevel'),plate=equipment.getObjectByName('TankIdentificationPlate');
  const labels=[
    {key:'equipment',text:spec.equipment.name,point:labelOffset(layout.origin,5.75*layout.scales.tank[1])},
    {key:'rootValve',text:'根部隔离阀',point:labelOffset(layout.anchors.rootValve,.55*layout.scales.tank[1])},
    {key:'leak',text:'阀后液体释放点',point:labelOffset(layout.leak,.24),show:'leak'},
    {key:'pool',text:'预设湿润区 / 池火根部',point:labelOffset(layout.poolCenter,.10),show:'pool'},
  ];
  group.userData={visualAdapter:'kimi-m01',geometryKind:'tank',layout,anchors:layout.anchors,resourceCounts:counts,
    source:'User-supplied Kimi M01 2026-11-24; adapted geometry and deterministic liquid only',
    flameOwner:'host-depth-raymarch',clockOwner:'workbench-frame-progress',supplierFlameMesh:false,
    poolRelocated:layout.relocated,requestedPoolRadiusM:layout.poolRadius,plateText:lines.map(line=>line.text)};
  let disposed=false;
  const api={group,labels,
    update(current,frame){
      if(disposed)return;
      labels[0].text=current.equipment.name;
      const level=current.equipment.liquidLevelM;
      liquidGauge.visible=Number.isFinite(level)&&level>0;
      if(liquidGauge.visible){
        const fill=3.7*clamp(level/current.equipment.geometry.heightM,0,1);
        liquidGauge.scale.y=fill;liquidGauge.position.y=.45+fill/2;
      }
      lines=plateLines(current);const signature=JSON.stringify(lines);
      if(signature!==plateSignature){
        const oldTexture=plate.material.map;
        plate.material.map=trackTexture(makeTextTexture(lines));plate.material.needsUpdate=true;
        releaseTexture(oldTexture);plateSignature=signature;
        group.userData.plateText=lines.map(line=>line.text);
      }
      const artProgress=m01Progress(frame?.progress);
      effects.setAssisted(current.visual?.mode==='assisted');effects.sample(artProgress);
      group.userData.progress=Number.isFinite(frame?.progress)?clamp(frame.progress,0,1):0;
      group.userData.artProgress=artProgress;
      const points=(current.receptors||[]).filter(p=>['x','y','z'].every(key=>Number.isFinite(p[key]))).slice(0,64);
      receptors.count=points.length;
      for(let i=0;i<points.length;i++){receptorTransform.makeTranslation(...localYup(points[i]));receptors.setMatrixAt(i,receptorTransform);}
      receptors.instanceMatrix.needsUpdate=true;
    },
    dispose(){
      if(disposed)return;disposed=true;
      group.removeFromParent();group.clear();
      for(const object of instancedMeshes)object.dispose();
      for(const geometry of geometries){geometry.dispose();counts.disposedGeometries++;lifecycle.disposedGeometry?.();}
      for(const material of materials){material.dispose();counts.disposedMaterials++;lifecycle.disposedMaterial?.();}
      for(const texture of [...textures])releaseTexture(texture);
      geometries.clear();materials.clear();instancedMeshes.clear();
      group.userData.disposed=true;
    },
  };
  api.update(spec,{progress:0});
  return api;
}

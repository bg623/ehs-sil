import { clone } from "./schema.mjs";
import { deriveQuantity, equipmentById } from "./presets.mjs";
import { checkCompatibility } from "./compatibility.mjs";
import { poolVisualBounds } from './rendering/pool-visual-bounds.mjs';
import { isM01Candidate, deriveM01Layout } from './kimi-m01/contract.mjs';

const point = (x,y,z) => ({x,y,z});
const normalize = ({x,y,z}) => {
  const length = Math.hypot(x,y,z) || 1;
  return point(x/length,y/length,z/length);
};

export function buildSceneSpec(p, c) {
  const d = c.scenarios.scenarios.find((x) => x.id === p.inputs.scenario.id);
  if (!d) throw Error("事故机制未提供，不能回退为池火");
  const material = clone(p.inputs.material), eq = clone(p.inputs.equipment),
    q = deriveQuantity(p), support = checkCompatibility(p,c),
    catalog = equipmentById(c,eq.id),
    geometryKind = catalog?.geometryKind || "tank",
    D = eq.geometry.diameterM, H = eq.geometry.heightM,
    known = D !== null && eq.leakAnchor !== null;
  eq.anchors = {
    tank:point(0,0,0),
    outlet:known ? point(D/2+.12,0,.55) : null,
    rootValve:known ? point(D/2+.65,0,.55) : null,
    leak:known ? point(D/2+1.15,0,.48) : null,
    poolCenter:known ? point(D/2+1.95,0,.03) : null,
  };
  if (known && eq.leakAnchor === "tank-wall") {
    const a=-Math.PI/6;
    eq.anchors.leak=point(D/2*Math.cos(a),D/2*Math.sin(a),.6);
    eq.anchors.poolCenter=point((D/2+1.8)*Math.cos(a),(D/2+1.8)*Math.sin(a),.03);
  }
  eq.liquidLevelM=q.liquidLevelM;
  const poolCenter=eq.anchors.poolCenter || point(3.95,0,.03),
    radius=p.inputs.pool.radiusM ?? 1.2,
    process={
      kind:d.id==="vce" ? "vapor-cloud-explosion" : d.id,geometryKind,direction:normalize(point(1,0,.08)),
      nozzle:{position:clone(eq.anchors.leak || point(3.15,0,.48)),direction:normalize(point(1,0,-.12)),radiusM:.035},
      domain:{min:point(poolCenter.x-radius-.5,poolCenter.y-radius-.5,0),max:point(poolCenter.x+radius+.5,poolCenter.y+radius+.5,7)},
      cloud:{center:point(2,0,1.6),radii:point(4,2,1.4)},
      ignition:{position:point(poolCenter.x-radius*.7,poolCenter.y,.05)},
      congestion:d.id==="vce",
      liquid:material.state === "liquid" ? {
        outlet:clone(eq.anchors.leak || point(3.15,0,.48)),
        groundImpact:point(poolCenter.x-.7,poolCenter.y,.03),
        poolCenter:clone(poolCenter),wetRadiusM:radius,
      } : null,
      visualValidity:{kind:"teaching-only",phaseVerified:false,
        note:"尺寸、域、方向、传播和时序为视觉配置；未执行状态方程、源项、浓度、超压或后果校验。"},
    };
  if(d.id==='pool-fire')process.domain=poolVisualBounds(radius,poolCenter,process.direction);
  if (geometryKind === "pipe-rack") {
    const h=H ?? 1.6;
    process.nozzle={position:point(-2,0,Math.max(.3,h-.1)),direction:normalize(point(1,0,.08)),radiusM:.045};
    process.direction=clone(process.nozzle.direction);
    process.domain={min:point(-3,-3,0),max:point(9,4,Math.max(6,h+4))};
    process.cloud={center:point(2,0,1.6),radii:point(4,2,1.4)};
    process.ignition={position:point(4.5,-.3,.6)};
    process.liquid=null;
    eq.anchors.outlet=clone(process.nozzle.position);
    eq.anchors.rootValve=point(-3.2,0,process.nozzle.position.z);
    eq.anchors.leak=clone(process.nozzle.position);
    eq.anchors.poolCenter=null;
  } else if (geometryKind === "cabinet") {
    const w=D ?? 2.4,h=H ?? 3,depth=w*5/6;
    process.enclosure={min:point(-w/2,-depth/2,0),max:point(w/2,depth/2,h),
      opening:{center:point(0,-depth/2,h*.6),widthM:w*5/12,heightM:h*.4,direction:point(0,-1,0)}};
    process.nozzle={position:point(-w*.3,depth*.2,.5),direction:point(1,0,0),radiusM:.025};
    process.direction=point(0,-1,0);
    process.domain={min:point(-w,-depth/2-4,0),max:point(w,depth/2+1,h+2)};
    process.cloud={center:point(0,0,h*.45),radii:point(w*.42,depth*.42,h*.38)};
    process.ignition={position:point(-w*.2,0,h*.3)};
    process.liquid=null;
    eq.anchors.outlet=clone(process.nozzle.position);
    eq.anchors.rootValve=point(-w*.35,depth*.3,.5);
    eq.anchors.leak=clone(process.nozzle.position);
    eq.anchors.poolCenter=null;
  }
  const specific=material.composition === "pure",
    profile=c.visualProfiles.profiles.find(x=>x.id===(specific ? material.visualProfileRef : "generic-pool-fire"))
      || c.visualProfiles.profiles.find(x=>x.id==="generic-pool-fire");
  if (!profile) throw Error("通用视觉规则缺失");
  const mode=p.ui.visualMode,
    note=mode==="assisted" ? "可见性辅助已开启；液体/无色气体轮廓和火焰结构为教学增强，不代表真实颜色或可燃边界"
      : "自然外观示意，非实测影像；无色气体不默认显示为白烟",
    stages=support.canPlayDetailedStoryboard ? d.stages : [{id:"mechanism",title:`${d.name}机制`,text:d.mechanism,
      question:support.issues[0]?.message || d.difference,highlight:["mechanism"]}];
  const spec={sceneId:d.id,title:p.meta.title,material,equipment:eq,quantityDerived:q,
    pool:{radiusM:p.inputs.pool.radiusM,geometrySource:p.inputs.pool.geometrySource},
    visual:{profile:clone(profile),mode,note},process,support,scenario:clone(d),
    stages:clone(stages),receptors:clone(p.inputs.receptors),inputRevision:p.inputRevision,
    visualAdapter:'native'};
  if(isM01Candidate(spec)){
    const layout=deriveM01Layout(eq,radius);
    if(layout.valid){
      spec.visualAdapter='kimi-m01';
      eq.anchors=clone(layout.anchors);
      process.nozzle.position=clone(eq.anchors.leak);
      process.nozzle.direction=point(0,-1,0);
      process.liquid={outlet:clone(eq.anchors.leak),groundImpact:clone(eq.anchors.poolCenter),poolCenter:clone(eq.anchors.poolCenter),wetRadiusM:radius};
      process.ignition.position=point(eq.anchors.poolCenter.x-radius*.53,eq.anchors.poolCenter.y+radius*.13,.05);
      process.domain=poolVisualBounds(radius,eq.anchors.poolCenter,process.direction);
      process.visualValidity.adapter='kimi-m01';
    }else spec.visualAdapterNote=layout.reason;
  }
  return spec;
}

const clamp = (x) => Math.max(0,Math.min(1,x));
const rise = (p,a,b) => {const x=clamp((p-a)/(b-a));return x*x*(3-2*x);};
const pulse = (p,a,b,c) => rise(p,a,b)*(1-rise(p,b,c));

// Pure, seekable art timeline: all channels are dimensionless visual progress,
// never flow rates, concentration, flame speed, physical time or pressure.
export function sampleStoryboard(spec, progress, seed=1) {
  const p=clamp(Number.isFinite(progress) ? progress : 0), n=Math.max(1,spec.stages.length),
    index=Math.min(n-1,Math.floor(p*n)), stageProgress=p===1 ? 1 : p*n-index,
    detailed=spec.support.canPlayDetailedStoryboard,
    frame={progress:p,stage:index,stageProgress,seed:Number.isFinite(seed)?seed:1,noiseTime:p*13+(Number.isFinite(seed)?seed%997:1)*.001,
      highlight:spec.stages[index]?.highlight || [],
      releaseIntensity:0,releaseFront:0,liquidTail:0,poolScale:0,poolRetention:0,wetness:0,
      cloudGrowth:0,combustionProgress:0,fireIntensity:0,ventIntensity:0,dissipation:0,pressureProgress:null,
      burnFront:0,cloudConsumption:0,jetIntensity:0,internalFire:0,ventOpening:0,ventFire:0,pressurePulse:0,afterglow:0,
      leakVisible:false,poolVisible:false,fireVisible:false,fireGrowth:0};
  if (!detailed) return frame;
  const kind=spec.process?.kind || spec.sceneId;
  if (kind==="pool-fire") {
    frame.releaseIntensity=rise(p,.12,.24)*(1-rise(p,.82,.94));
    frame.releaseFront=rise(p,.12,.26);frame.liquidTail=rise(p,.82,.94);
    frame.poolScale=rise(p,.20,.48);
    frame.poolRetention=frame.poolScale*(1-.12*rise(p,.90,1));frame.wetness=frame.poolRetention;
    frame.combustionProgress=rise(p,.43,.66);
    frame.fireIntensity=frame.combustionProgress*(1-.2*rise(p,.88,1));
    frame.afterglow=rise(p,.88,1);frame.dissipation=.12*rise(p,.90,1);
  } else if (kind==="jet-fire") {
    frame.releaseIntensity=rise(p,.08,.22)*(1-rise(p,.76,.94));
    frame.releaseFront=rise(p,.08,.22);
    frame.combustionProgress=rise(p,.26,.44);
    frame.jetIntensity=frame.combustionProgress*(1-rise(p,.80,.98));
    frame.fireIntensity=frame.jetIntensity;frame.afterglow=pulse(p,.82,.92,1);frame.dissipation=rise(p,.83,1);
  } else if (kind==="flash-fire") {
    frame.releaseIntensity=rise(p,.06,.20)*(1-rise(p,.4,.58));
    frame.cloudGrowth=rise(p,.12,.45);
    frame.combustionProgress=rise(p,.47,.80);frame.cloudConsumption=frame.combustionProgress;
    frame.fireIntensity=pulse(p,.47,.65,.88);frame.afterglow=pulse(p,.80,.9,1);frame.dissipation=rise(p,.83,1);
  } else if (kind==="vce" || kind==="vapor-cloud-explosion") {
    frame.releaseIntensity=rise(p,.04,.20)*(1-rise(p,.40,.58));
    frame.cloudGrowth=rise(p,.1,.47);
    frame.combustionProgress=rise(p,.50,.76);frame.cloudConsumption=frame.combustionProgress;
    frame.fireIntensity=pulse(p,.50,.68,.91);
    frame.pressureProgress=rise(p,.66,.90);frame.pressurePulse=pulse(p,.66,.76,.93);
    frame.afterglow=pulse(p,.81,.90,1);frame.dissipation=rise(p,.86,1);
  } else if (kind==="confined-deflagration") {
    frame.releaseIntensity=rise(p,.04,.16)*(1-rise(p,.28,.43));
    frame.cloudGrowth=rise(p,.1,.37);frame.combustionProgress=rise(p,.43,.64);
    frame.cloudConsumption=frame.combustionProgress;
    frame.internalFire=pulse(p,.43,.60,.88);frame.fireIntensity=frame.internalFire;
    frame.ventOpening=rise(p,.57,.70);frame.ventIntensity=pulse(p,.62,.77,.96);frame.ventFire=frame.ventIntensity;
    frame.pressureProgress=rise(p,.55,.79);frame.pressurePulse=pulse(p,.55,.66,.83);
    frame.afterglow=pulse(p,.84,.92,1);frame.dissipation=rise(p,.88,1);
  }
  frame.burnFront=frame.combustionProgress;
  frame.fireGrowth=frame.fireIntensity;
  frame.leakVisible=frame.releaseIntensity>.001;
  frame.poolVisible=kind==="pool-fire" && frame.poolScale>.001;
  frame.fireVisible=Math.max(frame.fireIntensity,frame.ventIntensity,frame.afterglow)>.001;
  return frame;
}

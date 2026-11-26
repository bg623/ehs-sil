import * as THREE from 'three';
import {worldToThree} from '../coordinates.mjs';
import {createIndustrialPalette} from '../materials/industrial-palette.mjs';
import {createLiquidRelease} from '../effects/liquid-release.mjs';
import {createM01Assembly} from '../kimi-m01/assembly.mjs';
const vec=p=>new THREE.Vector3(...worldToThree(p)),shift=(p,x=0,y=0,z=0)=>({x:p.x+x,y:p.y+y,z:p.z+z}),finite=(n,f)=>Number.isFinite(n)?n:f,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Opaque industrial geometry only; combustion belongs to the volume renderer. */
export function createSceneAssembly(spec,lifecycle={}){
 if(spec.visualAdapter==='kimi-m01')return createM01Assembly(spec,lifecycle);
 const group=new THREE.Group(),geometries=new Set(),materials=new Set(),textures=new Set(),cache=new Map(),labels=[];
 const geometry=g=>{geometries.add(g);lifecycle.createdGeometry?.();return g;},material=m=>{materials.add(m);lifecycle.createdMaterial?.();return m;},texture=t=>{textures.add(t);lifecycle.createdTexture?.();return t;};
 const palette=createIndustrialPalette({material,texture}),kind=spec.process?.geometryKind||'tank';group.name='industrial-'+kind;group.userData.geometryKind=kind;
 const eq=spec.equipment,anchors=eq.anchors||{},origin=anchors.tank||{x:0,y:0,z:0},dimensions=eq.geometry||{},d=finite(dimensions.diameterM,4),h=finite(dimensions.heightM,4),r=d/2,process=spec.process||{};
 const cached=(key,make)=>{if(!cache.has(key))cache.set(key,geometry(make()));return cache.get(key);};
 function place(g,m,p,parent=group,name=''){const object=new THREE.Mesh(g,m);object.position.copy(vec(p));object.castShadow=object.receiveShadow=true;object.name=name;parent.add(object);return object;}
 function box(size,p,m=palette.steel,parent=group,name=''){return place(cached(`box:${size.x}:${size.y}:${size.z}`,()=>new THREE.BoxGeometry(size.x,size.z,size.y)),m,p,parent,name);}
 function cylinder(radius,length,p,m=palette.steel,segments=24,parent=group,name=''){return place(cached(`cyl:${radius}:${length}:${segments}`,()=>new THREE.CylinderGeometry(radius,radius,length,segments)),m,p,parent,name);}
 function pipe(a,b,radius=.065,m=palette.steel,parent=group){const av=vec(a),bv=vec(b),direction=bv.clone().sub(av),length=direction.length();if(length<.00001)return null;const object=place(cached(`pipe:${radius}:${length.toFixed(5)}`,()=>new THREE.CylinderGeometry(radius,radius,length,16)),m,{x:0,y:0,z:0},parent,'industrial-pipe');object.position.copy(av.add(bv).multiplyScalar(.5));object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return object;}
 function flange(p,direction,radius=.19){
  const n=vec(direction).normalize(),disc=cylinder(radius,.07,p,palette.paleSteel,32,group,'bolted-flange');disc.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const u=new THREE.Vector3(1,0,0);if(Math.abs(u.dot(n))>.8)u.set(0,0,1);u.cross(n).normalize();const v=new THREE.Vector3().crossVectors(n,u).normalize(),center=vec(p);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,point=center.clone().addScaledVector(u,Math.cos(a)*radius*.77).addScaledVector(v,Math.sin(a)*radius*.77),bolt=cylinder(.025,.085,{x:0,y:0,z:0},palette.darkSteel,6);bolt.position.copy(point);bolt.quaternion.copy(disc.quaternion);}
 }
 function valve(p,direction={x:1,y:0,z:0}){
  const body=place(cached('valve-body',()=>new THREE.SphereGeometry(.17,18,12)),palette.painted,p,group,'root-isolation-valve');body.scale.set(1.2,.8,.85);
  pipe(p,shift(p,0,0,.41),.035,palette.darkSteel);const top=shift(p,0,0,.43),wheel=place(cached('valve-wheel',()=>new THREE.TorusGeometry(.18,.023,8,28)),palette.red,top,group,'valve-handwheel');wheel.rotation.x=Math.PI/2;
  pipe(shift(top,-.17,0),shift(top,.17,0),.014,palette.red);pipe(shift(top,0,-.17),shift(top,0,.17),.014,palette.red);
  const n=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();flange(shift(p,-n.x*.25,-n.y*.25,-n.z*.25),direction);flange(shift(p,n.x*.25,n.y*.25,n.z*.25),direction);
 }
 function contact(p,sx,sy){const shadow=place(cached('contact-quad',()=>new THREE.PlaneGeometry(1,1)),palette.contact,shift(p,0,0,.004));shadow.rotation.x=-Math.PI/2;shadow.scale.set(sx,sy,1);shadow.castShadow=shadow.receiveShadow=false;shadow.renderOrder=0;return shadow;}
 function ghost(object){const outline=new THREE.LineSegments(geometry(new THREE.EdgesGeometry(object.geometry,24)),palette.ghost);outline.position.copy(object.position);outline.quaternion.copy(object.quaternion);outline.scale.copy(object.scale);outline.visible=false;group.add(outline);return outline;}
 const groundBounds=process.domain?{min:process.domain.min,max:process.domain.max}:null;
 const floorLength=Math.max(10,finite(eq.containment?.lengthM,12)+3,groundBounds?groundBounds.max.x-groundBounds.min.x+4:0),floorWidth=Math.max(9,finite(eq.containment?.widthM,10)+3,groundBounds?groundBounds.max.y-groundBounds.min.y+4:0),floorCenter=kind==='tank'?origin:groundBounds?{x:(groundBounds.min.x+groundBounds.max.x)/2,y:(groundBounds.min.y+groundBounds.max.y)/2,z:0}:origin;
 const floor=box({x:floorLength,y:floorWidth,z:.16},shift(floorCenter,0,0,-.12),palette.ground,group,'concrete-yard');floor.castShadow=false;
 for(let i=-2;i<=2;i++){const joint=box({x:floorLength-.15,y:.012,z:.002},shift(floorCenter,0,i*2,-.033),palette.darkSteel);joint.castShadow=false;}
 let levelGauge=null,cutPanels=[],wallGhosts=[],ventHinge=null;
 function tankEnvironment(){
  if(!(d>0&&h>0&&d<1000&&h<1000))throw Error('设备示意尺寸无效');const c=eq.containment||{},length=finite(c.lengthM,12),width=finite(c.widthM,10),wallHeight=finite(c.heightM,.45);
  box({x:length,y:width,z:.10},shift(origin,0,0,-.04),palette.concrete,group,'bund-floor');
  for(const[x,y,a,b]of [[0,width/2,length+.18,.18],[0,-width/2,length+.18,.18],[-length/2,0,.18,width],[length/2,0,.18,width]])box({x:a,y:b,z:wallHeight},shift(origin,x,y,wallHeight/2),palette.concrete,group,'containment-wall');
  contact(shift(origin,0,0,.014),d+1.8,d+1.8);cylinder(r+.28,.24,shift(origin,0,0,.09),palette.concrete,64,group,'tank-foundation');
  const wall=place(cached(`tank-shell:${r}:${h}`,()=>new THREE.CylinderGeometry(r,r,h,64,1,true)),palette.steel,shift(origin,0,0,h/2+.23),group,'opaque-tank-shell');
  if(dimensions.orientation==='horizontal'){
   wall.rotation.z=Math.PI/2;wall.position.copy(vec(shift(origin,0,0,r+.48)));
   for(const x of [-h/2,h/2]){const end=cylinder(r,.10,shift(origin,x,0,r+.48),palette.paleSteel,48);end.rotation.z=Math.PI/2;}
   for(const x of [-h*.3,h*.3])box({x:.46,y:d*.86,z:.55},shift(origin,x,0,.25),palette.concrete);
  }else{
   cylinder(r,.12,shift(origin,0,0,.23),palette.steel,64);const rise=Math.max(.26,r*.14);place(cached(`roof:${r}:${rise}`,()=>new THREE.ConeGeometry(r+.045,rise,64)),palette.paleSteel,shift(origin,0,0,h+.23+rise/2),group,'fixed-cone-roof');
   for(const z of [.28,h*.4,h*.78,h+.20]){const ring=place(cached(`stiffener:${r}`,()=>new THREE.TorusGeometry(r+.012,.028,6,64)),palette.darkSteel,shift(origin,0,0,z+.13),group,'tank-stiffener');ring.rotation.x=Math.PI/2;}
   for(let i=0;i<10;i++){const a=i*Math.PI/5;pipe(shift(origin,Math.cos(a)*r*.06,Math.sin(a)*r*.06,h+.23+rise),shift(origin,Math.cos(a)*r*.96,Math.sin(a)*r*.96,h+.25),.012,palette.darkSteel);}
   const railHeight=h+.92,rail=place(cached(`top-rail:${r}`,()=>new THREE.TorusGeometry(r*.86,.025,7,64)),palette.paleSteel,shift(origin,0,0,railHeight),group,'roof-safety-rail');rail.rotation.x=Math.PI/2;
   for(let i=0;i<12;i++){const a=i*Math.PI/6;pipe(shift(origin,Math.cos(a)*r*.86,Math.sin(a)*r*.86,h+.37),shift(origin,Math.cos(a)*r*.86,Math.sin(a)*r*.86,railHeight),.022,palette.paleSteel);}
   const ladderX=-r-.20;for(const y of [-.24,.24])pipe(shift(origin,ladderX,y,.25),shift(origin,ladderX,y,h+.85),.034,palette.paleSteel);
   const steps=Math.min(32,Math.ceil(h/.27));for(let i=0;i<steps;i++)pipe(shift(origin,ladderX,-.25,.35+i*h/steps),shift(origin,ladderX,.25,.35+i*h/steps),.024,palette.darkSteel);
   const manway=shift(origin,0,-r-.04,.94);flange(manway,{x:0,y:-1,z:0},.34);const cover=cylinder(.27,.09,shift(manway,0,-.06,0),palette.paleSteel,36,group,'bolted-manway');cover.rotation.x=Math.PI/2;
   const gaugeBase=shift(origin,r*.58,-r*.82-.07,.28);box({x:.14,y:.06,z:h},shift(gaugeBase,0,0,h/2),palette.black,group,'external-level-indicator');levelGauge=box({x:.085,y:.072,z:1},gaugeBase,palette.indicator,group,'inventory-level-display');levelGauge.userData.base=gaugeBase;
  }
  if(anchors.outlet&&anchors.rootValve){pipe(shift(anchors.outlet,-.22,0),anchors.outlet,.11);flange(anchors.outlet,{x:1,y:0,z:0},.18);pipe(anchors.outlet,anchors.rootValve,.105);if(anchors.leak){pipe(anchors.rootValve,anchors.leak,.105);flange(shift(anchors.leak,-.12,0,0),{x:1,y:0,z:0});}valve(anchors.rootValve);labels.push({key:'rootValve',text:'根部隔离阀',point:shift(anchors.rootValve,0,0,.68)});}
  const drain=shift(origin,-length/2+.75,-width/2,.12);pipe(shift(drain,0,-.42),shift(drain,0,.35),.07,palette.darkSteel);valve(shift(drain,0,-.12),{x:0,y:1,z:0});
  labels.push({key:'equipment',text:eq.name,point:shift(origin,0,0,h+1.0)});
  if(process.liquid)labels.push({key:'leak',text:'液体释放点',point:shift(process.liquid.outlet,0,0,.24),show:'leak'},{key:'pool',text:'预设湿润区 / 池火根部',point:shift(process.liquid.poolCenter,0,0,.10),show:'pool'});
 }
 function pipeEnvironment(){
  const nozzle=process.nozzle||{position:{x:-2,y:0,z:1.5},direction:{x:1,y:0,z:.08},radiusM:.06},congested=process.congestion===true;
  const rackMin=groundBounds?Math.max(groundBounds.min.x+.7,nozzle.position.x+.5):-1.5,rackMax=groundBounds?groundBounds.max.x-1:6,frames=congested?5:2,height=congested?3.3:2.2,halfWidth=congested?1.55:.8;
  for(let i=0;i<frames;i++){const x=rackMin+(rackMax-rackMin)*i/Math.max(1,frames-1);for(const y of [-halfWidth,halfWidth]){box({x:.5,y:.5,z:.18},{x,y,z:.05},palette.concrete);box({x:.16,y:.16,z:height},{x,y,z:height/2+.12},palette.darkSteel,group,'rack-column');contact({x,y,z:.008},.9,.9);}box({x:.20,y:halfWidth*2+.28,z:.17},{x,y:0,z:height+.1},palette.darkSteel,group,'rack-crossbeam');if(congested)pipe({x,y:-halfWidth,z:.5},{x,y:halfWidth,z:height-.15},.036,palette.darkSteel);}
  const count=congested?8:2;for(let i=0;i<count;i++){const y=-halfWidth*.76+(halfWidth*1.52)*(i%4)/Math.max(1,Math.min(3,count-1)),z=height+.25+Math.floor(i/4)*.58;pipe({x:rackMin-.35,y,z},{x:rackMax+.35,y,z},i%3===0?.14:.085,i%3===0?palette.painted:palette.steel);if(congested)for(const x of [rackMin+.35,rackMax-.35])flange({x,y,z},{x:1,y:0,z:0},i%3===0?.22:.16);}
  const p=nozzle.position,n=nozzle.direction,upstream=shift(p,-n.x*1.75,-n.y*1.75,-n.z*1.75);pipe(upstream,p,Math.max(.065,finite(nozzle.radiusM,.06)));flange(shift(p,-n.x*.12,-n.y*.12,-n.z*.12),n,.18);valve(shift(p,-n.x*.7,-n.y*.7,-n.z*.7),n);
  box({x:2.4,y:1.25,z:.16},shift(upstream,-.2,0,-upstream.z+.07),palette.darkSteel,group,'pipeline-skid-base');for(const x of [upstream.x-.6,upstream.x+.4]){box({x:.18,y:.72,z:Math.max(.25,p.z-.2)},{x,y:upstream.y,z:(p.z-.2)/2+.16},palette.paleSteel);contact({x,y:upstream.y,z:.008},.65,1.1);}
  if(congested)for(let i=0;i<3;i++){const p={x:rackMin+.8+i*1.2,y:halfWidth-.5,z:.65};cylinder(.32,1.1,p,palette.paleSteel,24,group,'congestion-vessel');pipe(shift(p,0,0,.5),shift(p,.6,0,1.2),.07);}
  for(const y of [-halfWidth-.65,halfWidth+.65]){const stripe=box({x:rackMax-rackMin+1.2,y:.065,z:.003},{x:(rackMin+rackMax)/2,y,z:-.033},palette.yellow);stripe.castShadow=false;}
  labels.push({key:'equipment',text:congested?'局部拥塞管廊':'气相管线与工艺撬块',point:{x:(rackMin+rackMax)/2,y:0,z:height+.85}},{key:'nozzle',text:'带压释放喷口',point:shift(p,0,0,.25),show:'leak'});if(process.ignition)labels.push({key:'ignition',text:'预设点火位置',point:shift(process.ignition.position,0,0,.15),show:'fire'});
 }
 function cabinetEnvironment(){
  const e=process.enclosure||{min:{x:-1.2,y:-1,z:0},max:{x:1.2,y:1,z:3},opening:{center:{x:0,y:-1,z:1.8},widthM:1,heightM:1.2,direction:{x:0,y:-1,z:0}}},a=e.min,b=e.max,w=b.x-a.x,depth=b.y-a.y,height=b.z-a.z,c={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:a.z},thickness=.085,opening=e.opening;
  box({x:w+.34,y:depth+.34,z:.16},shift(c,0,0,-.05),palette.concrete,group,'cabinet-foundation');contact(shift(c,0,0,.006),w+1.1,depth+1.1);box({x:w,y:depth,z:.075},shift(c,0,0,.075),palette.darkSteel,group,'cabinet-floor');
  box({x:w,y:thickness,z:height},{x:c.x,y:b.y,z:a.z+height/2},palette.painted,group,'cabinet-rear-wall');for(const x of [a.x,b.x])box({x:thickness,y:depth,z:height},{x,y:c.y,z:a.z+height/2},palette.painted,group,'cabinet-side-wall');
  const roof=box({x:w+thickness,y:depth+thickness,z:thickness},{x:c.x,y:c.y,z:b.z},palette.paleSteel,group,'cabinet-roof');cutPanels.push(roof);wallGhosts.push(ghost(roof));
  const left=clamp(opening.center.x-opening.widthM/2,a.x+.08,b.x-.1),right=clamp(opening.center.x+opening.widthM/2,a.x+.1,b.x-.08),bottom=clamp(opening.center.z-opening.heightM/2,a.z+.08,b.z-.1),top=clamp(opening.center.z+opening.heightM/2,a.z+.1,b.z-.08);
  const panel=(x,z,sx,sz)=>{if(sx<.001||sz<.001)return;const object=box({x:sx,y:thickness,z:sz},{x,y:a.y,z},palette.painted,group,'cabinet-front-wall');cutPanels.push(object);wallGhosts.push(ghost(object));};panel((a.x+left)/2,a.z+height/2,left-a.x,height);panel((right+b.x)/2,a.z+height/2,b.x-right,height);panel((left+right)/2,(a.z+bottom)/2,right-left,bottom-a.z);panel((left+right)/2,(top+b.z)/2,right-left,b.z-top);
  for(const x of [left,right])box({x:.065,y:.13,z:top-bottom},{x,y:a.y-.035,z:(top+bottom)/2},palette.yellow,group,'vent-opening-frame');for(const z of [bottom,top])box({x:right-left+.06,y:.13,z:.065},{x:(left+right)/2,y:a.y-.035,z},palette.yellow,group,'vent-opening-frame');
  ventHinge=new THREE.Group();ventHinge.name='preset-vent-panel-hinge';ventHinge.position.copy(vec({x:(left+right)/2,y:a.y-.075,z:top}));group.add(ventHinge);const door=box({x:right-left-.04,y:.045,z:top-bottom-.04},{x:0,y:0,z:0},palette.paleSteel,ventHinge,'preset-vent-panel');door.position.set(0,-(top-bottom)/2,0);
  for(const z of [.55,1.4])box({x:w*.72,y:depth*.48,z:.055},{x:c.x,y:c.y+.25,z:a.z+z},palette.darkSteel,group,'internal-equipment-shelf');box({x:w*.45,y:.35,z:.58},{x:c.x,y:b.y-.25,z:a.z+1.76},palette.black,group,'internal-control-enclosure');for(let i=0;i<4;i++)box({x:.13,y:.045,z:.22},{x:c.x-.33+i*.22,y:b.y-.445,z:a.z+1.8},i===3?palette.red:palette.paleSteel,group,'internal-control-module');
  const nozzle=process.nozzle;if(nozzle){const p=nozzle.position,n=nozzle.direction;pipe(shift(p,-n.x*.7,-n.y*.7,-n.z*.7),p,finite(nozzle.radiusM,.045));flange(shift(p,-n.x*.10,-n.y*.10,-n.z*.10),n,.13);}
  labels.push({key:'equipment',text:'设备柜 / 受限内部空间',point:{x:c.x,y:c.y,z:b.z+.38}},{key:'opening',text:'预设泄压开口（非结构计算）',point:shift(opening.center,0,-.12,.14),show:'fire'});if(nozzle)labels.push({key:'nozzle',text:'内部释放点',point:shift(nozzle.position,0,0,.2),show:'leak'});
 }
 if(kind==='tank')tankEnvironment();else if(kind==='cabinet')cabinetEnvironment();else pipeEnvironment();
 const liquid=createLiquidRelease(spec,lifecycle);group.add(liquid.group);
 const receptorGeometry=geometry(new THREE.SphereGeometry(.10,10,7)),receptors=new THREE.InstancedMesh(receptorGeometry,palette.yellow,64);receptors.count=0;receptors.castShadow=true;group.add(receptors);const receptorTransform=new THREE.Matrix4();let disposed=false;
 return {group,labels,
  update(current,frame,{cutaway=false}={}){
   if(disposed)return;const label=labels.find(l=>l.key==='equipment');if(label&&kind==='tank')label.text=current.equipment.name;
   if(levelGauge){const level=current.equipment.liquidLevelM;levelGauge.visible=Number.isFinite(level)&&level>0;if(levelGauge.visible){const shown=clamp(level,0,h);levelGauge.scale.y=shown;levelGauge.position.copy(vec(shift(levelGauge.userData.base,0,0,shown/2)));}}
   for(const object of cutPanels)object.visible=!cutaway;for(const object of wallGhosts)object.visible=cutaway;if(ventHinge){ventHinge.visible=!cutaway;ventHinge.rotation.x=-clamp(finite(frame.ventOpening,frame.ventIntensity||0),0,1)*1.48;}
   liquid.update(current,frame);receptors.count=Math.min(64,current.receptors?.length||0);for(let i=0;i<receptors.count;i++){receptorTransform.makeTranslation(...worldToThree(current.receptors[i]));receptors.setMatrixAt(i,receptorTransform);}receptors.instanceMatrix.needsUpdate=true;
  },
  dispose(){if(disposed)return;disposed=true;liquid.dispose();group.removeFromParent();group.clear();for(const g of geometries){g.dispose();lifecycle.disposedGeometry?.();}for(const m of materials){m.dispose();lifecycle.disposedMaterial?.();}for(const t of textures){t.dispose();lifecycle.disposedTexture?.();}geometries.clear();materials.clear();textures.clear();cache.clear();},
 };
}

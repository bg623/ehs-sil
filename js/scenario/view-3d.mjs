import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {worldToThree} from './coordinates.mjs';
export function create3d(host,onFail){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setClearColor(0xedf2ef);renderer.outputColorSpace=THREE.SRGBColorSpace;host.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','可拖动旋转的池火三维教学场景');renderer.domElement.setAttribute('role','img');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(16,12,19);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2,0);controls.enableDamping=false;controls.minDistance=10;controls.maxDistance=38;controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xffffff,0x637d70,2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(4,13,8);scene.add(sun);
  const materials=[],geometries=[];
  function mesh(g,color,pos,opts={}){geometries.push(g);const m=new THREE.MeshStandardMaterial({color,...opts});materials.push(m);const a=new THREE.Mesh(g,m);a.position.set(...worldToThree({x:pos[0],y:pos[1],z:pos[2]}));scene.add(a);return a;}
  mesh(new THREE.BoxGeometry(24,.15,19),0xdfe8e2,[0,0,-.2]);
  mesh(new THREE.BoxGeometry(.12,.12,2),0x0d473f,[-9,5,.1]);
  const north=mesh(new THREE.ConeGeometry(.32,.7,3),0x0d473f,[-9,6.3,.1]);north.rotation.x=-Math.PI/2;
  const compass=document.createElement('small');compass.className='sc-compass';compass.textContent='N 北：地面箭头方向';host.append(compass);
  mesh(new THREE.CylinderGeometry(2,2,5,40),0x8daaa0,[-5,0,2.5],{metalness:.3,roughness:.5});
  mesh(new THREE.CylinderGeometry(2.08,2.08,.18,40),0xc5d1cc,[-5,0,5.1]);
  for(const z of [1,4]){const a=mesh(new THREE.TorusGeometry(2.02,.06,6,40),0x0d473f,[-5,0,z]);a.rotation.x=Math.PI/2;}
  mesh(new THREE.BoxGeometry(4,.28,.3),0x68746f,[-1.4,0,.65]);
  for(const [x,y,w,h]of [[3,3.6,8,.2],[3,-3.6,8,.2],[-1,0,.2,7.4],[7,0,.2,7.4]])mesh(new THREE.BoxGeometry(w,.45,h),0x6c8e80,[x,y,.1]);
  const liquid=mesh(new THREE.CylinderGeometry(3,3,.07,48),0x2f6280,[3,0,.02],{transparent:true,opacity:.7});
  const leak=mesh(new THREE.BoxGeometry(2.4,.05,.4),0x2f6280,[.6,0,.06]);
  const flames=[];
  for(let i=0;i<26;i++){const angle=i*2.3999,r=Math.sqrt((i+.5)/26)*2.45;const a=mesh(new THREE.ConeGeometry(.5+(i%3)*.12,2.5+(i%5)*.38,7),i%2?0xf1c96f:0xd7a23a,[3+Math.cos(angle)*r,Math.sin(angle)*r,1.5],{emissive:0x805810,emissiveIntensity:.6,transparent:true,opacity:.88});flames.push(a);}
  const target=mesh(new THREE.CylinderGeometry(.3,.3,1.5,12),0x0d473f,[9,3,.75]);
  const markerGeometry=new THREE.SphereGeometry(.3,10,6),markerMaterial=new THREE.MeshStandardMaterial({color:0x0d473f});geometries.push(markerGeometry);materials.push(markerMaterial);
  const markers=new THREE.Group();scene.add(markers);let markerSignature='';
  let stage=0,frame=0,disposed=false;
  const draw=()=>{if(!disposed){renderer.render(scene,camera);frame++;host.dataset.frames=String(frame);host.dataset.geometries=String(renderer.info.memory.geometries);}};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();};
  controls.addEventListener('change',draw);const observer=new ResizeObserver(resize);observer.observe(host);
  const lost=e=>{e.preventDefault();onFail('WebGL 已中断，已恢复 2D 视图。');};renderer.domElement.addEventListener('webglcontextlost',lost);
  function update(result,nextStage,progress=0){stage=nextStage;liquid.visible=stage>=2;leak.visible=stage>=1;for(let i=0;i<flames.length;i++){const f=flames[i];f.visible=stage>=3;f.scale.y=1+.1*Math.sin(progress*40+i);f.rotation.y=progress*.4;}const receptors=result?.visualization.receptors||[],signature=JSON.stringify(receptors);if(signature!==markerSignature){markerSignature=signature;markers.clear();for(const r of receptors){const m=new THREE.Mesh(markerGeometry,markerMaterial);m.position.set(...worldToThree(r));markers.add(m);}}target.visible=!receptors.length;draw();}
  resize();update(null,0);
  return {update,reset(){camera.position.set(16,12,19);controls.target.set(0,2,0);controls.update();draw();},stats(){return {geometries:renderer.info.memory.geometries,frames:frame,sceneObjects:scene.children.length};},dispose(){disposed=true;observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();host.replaceChildren();}};
}

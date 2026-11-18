import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { worldToThree } from "./coordinates.mjs";
import { createSceneAssembly } from "./three/scene-components.mjs";
import { createVolumeRenderer, QUALITY_PROFILES } from './rendering/volume-renderer.mjs';
import { VOLUME_SCENARIOS } from './rendering/volume-field.mjs';
import { exportFrame as encodeFrame } from './export-frame.mjs';
import { APP_VERSION } from './version.mjs';
import { createDaylightEnvironment } from './rendering/volume-environment.mjs';

let liveRenderers = 0;
const enu = (p) => new THREE.Vector3(...worldToThree(p));
const PRIMARY_LABEL_KEYS=new Set(['equipment','leak','pool','nozzle','ignition','opening']);
const textStyle = {
  position: "absolute",
  pointerEvents: "none",
  fontFamily: "inherit",
  fontSize: "12px",
  lineHeight: "1.4",
  color: "#234f43",
  background: "rgba(248,251,249,.9)",
  border: "1px solid rgba(164,187,174,.7)",
  borderRadius: "6px",
  padding: "4px 7px",
};

/** One renderer, no private clock. The application supplies deterministic frames. */
export function create3d(host, onFail = () => {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  if(renderer.getContext().getParameter(renderer.getContext().MAX_3D_TEXTURE_SIZE)<64){renderer.dispose();throw Error('当前设备不支持64³ WebGL2体积纹理');}
  liveRenderers++;
  renderer.setClearColor(0xc8d8dc);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute(
    "aria-label",
    "当前物料与设备的三维教学场景；可拖动旋转或使用视角按钮",
  );
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.tabIndex = 0;
  host.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
  camera.position.set(12, 10, 13);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.6, 0);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.listenToKeyEvents(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe5f2ff, 0x7b8071, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(5, 12, 8);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;sun.shadow.camera.near=.5;sun.shadow.camera.far=55;sun.shadow.bias=-.0008;sun.shadow.normalBias=.035;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xd4e9e1, 0.65);
  rim.position.set(-8, 6, -6);
  scene.add(rim);
  const fireLight=new THREE.PointLight(0xffa34b,0,12,2);scene.add(fireLight);
  const note = document.createElement("div");
  note.className = "sc-visual-note";
  note.setAttribute("role", "status");
  Object.assign(note.style, textStyle, {
    left: "10px",
    bottom: "10px",
    maxWidth: "calc(100% - 20px)",
    zIndex: "3",
  });
  host.append(note);
  let spec = null,
    frame = null,
    assembly = null,
    signature = "",
    initialized = false,
    disposed = false,
    contextLost = false;
  let frameCount = 0,
    labelsVisible = true,
    labelNodes = [],
    leaderNodes = [],
    equipmentBuilds = 0,
    activeCamera = "overview",
    quality='balanced',cutaway=false,pressureVisible=false,labelDetail=false,
    lastFrameMs=0,totalFrameMs=0;
  const counts = {
    createdGeometries: 0,
    disposedGeometries: 0,
    createdMaterials: 0,
    disposedMaterials: 0,
    createdTextures:0,disposedTextures:0,
  };
  const lifecycle = {
    createdGeometry() {
      counts.createdGeometries++;
    },
    disposedGeometry() {
      counts.disposedGeometries++;
    },
    createdMaterial() {
      counts.createdMaterials++;
    },
    disposedMaterial() {
      counts.disposedMaterials++;
    },
    createdTexture(){counts.createdTextures++;},
    disposedTexture(){counts.disposedTextures++;},
  };
  const volume=createVolumeRenderer(renderer,lifecycle);
  let environment;
  try{environment=createDaylightEnvironment(renderer,lifecycle);}catch(error){volume.dispose();renderer.dispose();liveRenderers--;host.replaceChildren();throw error;}
  scene.environment=environment.texture;scene.environmentIntensity=.85;
  function stats() {
    return {
      ...counts,
      ...volume.stats(),
      environment:environment.stats(),
      activeRenderTargets:disposed?0:3,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      frames: frameCount,
      rendererCount: liveRenderers,
      activeLoops: 0,
      equipmentBuilds,
      sceneObjects: assembly ? assembly.group.children.length : 0,
      activeCamera,
      disposed,
      lastFrameMs,averageFrameMs:frameCount?totalFrameMs/frameCount:0,
      cutaway,pressureVisible,
    };
  }
  function writeStats() {
    const values = stats();
    for (const key of [
      "geometries",
      "textures",
      "frames",
      "rendererCount",
      "activeLoops",
      "equipmentBuilds",
      "createdGeometries",
      "disposedGeometries",
    ])
      host.dataset[key] = String(values[key]);
    host.dataset.quality=quality;host.dataset.renderer='volumetric-raymarch';host.dataset.raySteps=String(values.raySteps);host.dataset.renderTargets=String(values.activeRenderTargets);
  }
  function updateLabels() {
    if (!spec || !frame) return;
    if (!assembly || !assembly.group.visible) {
      for (const node of labelNodes) node.hidden = true;
      for (const node of leaderNodes) node.hidden = true;
      return;
    }
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const screen = (point) => {
      const p = enu(point).project(camera);
      return { x: ((p.x + 1) * w) / 2, y: ((1 - p.y) * h) / 2, z: p.z };
    };
    // Labels must not hide the weak methanol plume in a compact viewport.
    // Reserve only a teaching-visual envelope; this is not an impact boundary.
    let plume = null;
    if (frame.fireVisible && spec.equipment.anchors.poolCenter) {
      const center = spec.equipment.anchors.poolCenter,
        radius = spec.pool.radiusM,
        height = radius * 3.9,
        points = [];
      for (const [z, width] of [[0, radius * 0.9], [height * 0.55, radius * 0.48], [height, radius * 0.05]]) {
        for (const x of [-width, width])
          for (const y of [-width, width])
            points.push(screen({ x: center.x + x, y: center.y + y, z: center.z + 0.065 + z }));
      }
      if (points.every((p) => p.z > -1 && p.z < 1)) {
        plume = {
          x: Math.max(8, Math.min(...points.map((p) => p.x)) - 8),
          y: Math.max(8, Math.min(...points.map((p) => p.y)) - 8),
          right: Math.min(w - 8, Math.max(...points.map((p) => p.x)) + 8),
          bottom: Math.min(h - 65, Math.max(...points.map((p) => p.y)) + 8),
        };
      }
    }
    const placed = [],
      overlaps = (a, b, gap = 0) => a.x < b.right + gap && a.right > b.x - gap && a.y < b.bottom + gap && a.bottom > b.y - gap;
    const important=assembly.labels.map((d,i)=>({d,i})).filter(({d})=>PRIMARY_LABEL_KEYS.has(d.key)||d.important).map(({i})=>i).slice(0,3);
    for (let i = 0; i < labelNodes.length; i++) {
      const descriptor = assembly.labels[i],
        node = labelNodes[i],
        leader = leaderNodes[i];
      if (node.textContent !== descriptor.text)
        node.textContent = descriptor.text;
      const show =
        labelsVisible &&
        (labelDetail||important.includes(i)) &&
        (!descriptor.show ||
          (descriptor.show === "leak" && frame.leakVisible) ||
          (descriptor.show === "pool" && frame.poolVisible) ||
          (descriptor.show === 'cloud' && frame.cloudGrowth>0) ||
          (descriptor.show === 'fire' && frame.fireIntensity>0) ||
          (descriptor.show === 'vent' && frame.ventIntensity>0));
      const projected = screen(descriptor.point);
      node.hidden = !show || projected.z > 1 || projected.z < -1;
      leader.hidden = true;
      if (node.hidden) continue;
      const width = Math.min(node.offsetWidth, 200), height = node.offsetHeight,
        clampX = (x) => Math.max(8, Math.min(w - width - 8, x)),
        clampY = (y) => Math.max(8, Math.min(h - 65 - height, y)),
        x = clampX(projected.x), y = clampY(projected.y - 13),
        rect = (left, top) => ({ x: left, y: top, right: left + width, bottom: top + height });
      let box = rect(x, y);
      if (plume && (overlaps(box, plume) || placed.some((other) => overlaps(box, other, 5)))) {
        const candidates = [];
        const tops = [8, h - 65 - height];
        for (let offset = -4; offset <= 4; offset++) tops.push(y + offset * (height + 6));
        for (const left of [plume.right + 10, plume.x - width - 10, x, 8, w - width - 8]) {
          for (const top of tops) {
            const candidate = rect(clampX(left), clampY(top));
            const collisions = (overlaps(candidate, plume, 4) ? 1000000 : 0)
              + placed.filter((other) => overlaps(candidate, other, 5)).length * 100000;
            const keepAnchorColumn = left === x ? 80 : 0;
            candidates.push({ box: candidate, score: collisions + keepAnchorColumn + Math.hypot(candidate.x - x, candidate.y - y) });
          }
        }
        candidates.sort((a, b) => a.score - b.score);
        box = candidates[0].box;
      }
      placed.push(box);
      node.style.left = `${box.x}px`;
      node.style.top = `${box.y}px`;
      if (Math.hypot(box.x - x, box.y - y) > 8) {
        const endX = Math.max(box.x, Math.min(box.right, projected.x)),
          endY = Math.max(box.y, Math.min(box.bottom, projected.y)),
          dx = endX - projected.x, dy = endY - projected.y;
        Object.assign(leader.style, { left: `${projected.x}px`, top: `${projected.y}px`, width: `${Math.hypot(dx, dy)}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)` });
        leader.hidden = false;
      }
    }
  }
  function draw() {
    if (disposed || contextLost) return;
    const started=performance.now();
    try{volume.render(scene,camera,assembly?.group.visible?spec:null,frame,{pressure:pressureVisible});}
    catch(error){contextLost=true;queueMicrotask(()=>onFail(`体积渲染不可用，已恢复2D：${error.message}`));return;}
    lastFrameMs=performance.now()-started;totalFrameMs+=lastFrameMs;
    frameCount++;
    updateLabels();
    writeStats();
  }
  function resize() {
    if (disposed) return;
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, w < 680 ? 1 : QUALITY_PROFILES[quality].dpr),
    );
    renderer.setSize(w, h, false);
    const physical=renderer.getDrawingBufferSize(new THREE.Vector2());volume.resize(physical.x,physical.y);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  }
  function setCamera(name = "overview") {
    if (!spec || disposed) return false;
    const { geometry: g, anchors: a, containment: c } = spec.equipment;
    const tank = a.tank,
      span = Math.max(c.lengthM, c.widthM, g.heightM * 1.6);
    let target = { x: tank.x, y: tank.y, z: tank.z + g.heightM * 0.35 },
      eye;
    camera.up.set(0, 1, 0);
    if (name === "tank") {
      target.z = tank.z + g.heightM * 0.5;
      eye = {
        x: tank.x + g.diameterM * 1.7,
        y: tank.y - g.diameterM * 1.9,
        z: tank.z + g.heightM * 1.3,
      };
    } else if (name === "leak" || name === "pool") {
      const anchor = name === "leak" ? (a.leak||spec.process?.nozzle?.position) : (a.poolCenter||spec.process?.cloud?.center||spec.process?.nozzle?.position);
      if (!anchor) return false;
      target = { ...anchor };
      if (name === "pool") {
        const visualHeight = Math.max(3, spec.pool.radiusM * 3.9);
        target.z += visualHeight * 0.42;
        eye = { x: anchor.x + visualHeight * 1.1, y: anchor.y - visualHeight * 1.45, z: anchor.z + visualHeight * 1.38 };
      } else {
        eye = { x: anchor.x + 3.1, y: anchor.y - 4, z: anchor.z + 2.5 };
      }
    } else if (name === "top") {
      target = { ...tank, z: tank.z + 0.2 };
      eye = { x: tank.x + 0.001, y: tank.y - 0.001, z: tank.z + span * 1.4 };
      camera.up.set(0, 0, -1);
    } else {
      name = "overview";
      eye = {
        x: tank.x + span * 0.8,
        y: tank.y - span * 0.95,
        z: tank.z + span * 0.72,
      };
    }
    if(spec.sceneId!=='pool-fire'&&spec.process){
      const process=spec.process,from=process.domain?.min,to=process.domain?.max;
      const center=from&&to?{x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:(from.z+to.z)/2}:tank;
      const sceneSpan=from&&to?Math.max(to.x-from.x,to.y-from.y,(to.z-from.z)*1.4):span;
      if(name==='overview'){target={...center,z:Math.max(1,center.z*.7)};eye={x:center.x+sceneSpan*.78,y:center.y-sceneSpan*.88,z:Math.max(6,sceneSpan*.65)};}
      if(name==='leak'||name==='pool'){
        const focus=name==='leak'?process.nozzle?.position:(process.cloud?.center||process.nozzle?.position);
        if(focus){target={...focus};const offset=name==='pool'?Math.max(5,sceneSpan*.48):4;eye={x:focus.x+offset,y:focus.y-offset*1.2,z:focus.z+offset*.65};}
        if(name==='pool'&&spec.sceneId==='jet-fire'&&process.nozzle){
          const n=process.nozzle,dir=n.direction,L=process.jetLengthM||6.2;
          target={x:n.position.x+dir.x*L*.5,y:n.position.y+dir.y*L*.5,z:n.position.z+dir.z*L*.5+.35};
          eye={x:target.x-dir.y*7.3,y:target.y+dir.x*7.3,z:target.z+.45};
        }
      }
      if(name==='top'){target={...center,z:.5};eye={x:center.x+.001,y:center.y-.001,z:sceneSpan*1.45};}
    }
    controls.target.copy(enu(target));
    camera.position.copy(enu(eye));
    controls.update();
    activeCamera = name;
    draw();
    return true;
  }
  function removeAssembly() {
    for (const node of labelNodes) node.remove();
    for (const node of leaderNodes) node.remove();
    labelNodes = [];
    leaderNodes = [];
    assembly?.dispose();
    assembly = null;
  }
  function update(nextSpec, nextFrame) {
    if (disposed) return;
    spec = nextSpec;
    frame = nextFrame;
    host.dataset.sceneId = spec?.sceneId || "unspecified";
    host.dataset.materialId = spec?.material?.id || "unconfirmed";
    if (
      !spec ||
      !VOLUME_SCENARIOS.includes(spec.sceneId) ||
      !spec.support?.canPlayDetailedStoryboard
    ) {
      if (assembly) assembly.group.visible = false;
      for (const node of labelNodes) node.hidden = true;
      for (const node of leaderNodes) node.hidden = true;
      note.textContent =
        "当前为独立机制教学，详细 3D 尚未提供；请使用 2D 视图。";
      draw();
      return;
    }
    const nextSignature = JSON.stringify({
      geometry: spec.equipment.geometry,
      anchors: spec.equipment.anchors,
      containment: spec.equipment.containment,
      poolRadius: spec.pool.radiusM,
      geometryKind:spec.process?.geometryKind,
      process:spec.process&&{nozzle:spec.process.nozzle,enclosure:spec.process.enclosure,domain:spec.process.domain,congestion:spec.process.congestion},
    });
    if (nextSignature !== signature) {
      removeAssembly();
      signature = nextSignature;
      assembly = createSceneAssembly(spec, lifecycle);
      scene.add(assembly.group);
      equipmentBuilds++;
      labelNodes = assembly.labels.map((descriptor) => {
        const leader = document.createElement("span");
        leader.className = "sc-visual-leader";
        leader.setAttribute("aria-hidden", "true");
        leader.hidden = true;
        Object.assign(leader.style, { position: "absolute", height: "1px", background: "rgba(59,99,86,.52)", pointerEvents: "none", transformOrigin: "0 50%", zIndex: "1" });
        const node = document.createElement("span");
        node.className = "sc-visual-label";
        node.textContent = descriptor.text;
        Object.assign(node.style, textStyle, { maxWidth: "190px", zIndex: "2" });
        host.append(leader, node);
        leaderNodes.push(leader);
        return node;
      });
      const span = Math.max(
        spec.equipment.containment.lengthM,
        spec.equipment.containment.widthM,
        spec.equipment.geometry.heightM * 1.5,
      );
      controls.minDistance = Math.max(
        0.8,
        spec.equipment.geometry.diameterM * 0.6,
      );
      controls.maxDistance = span * 4;
      camera.near = Math.max(0.02, span / 2000);
      camera.far = Math.max(150, span * 12);
      camera.updateProjectionMatrix();
    }
    assembly.group.visible = true;
    assembly.update(spec, frame,{cutaway});
    const lightAnchor=spec.sceneId==='pool-fire'?spec.equipment.anchors.poolCenter:spec.process?.nozzle?.position;
    if(lightAnchor)fireLight.position.copy(enu({...lightAnchor,z:lightAnchor.z+1.0}));
    fireLight.color.set(spec.material.id==='methanol'?0x72b8ff:0xffa053);
    fireLight.intensity=(frame.fireIntensity??(frame.fireVisible?1:0))*(spec.material.id==='methanol'?(spec.visual.mode==='natural'?.15:.8):2.4);
    if (typeof spec.visual.labelsVisible === "boolean")
      labelsVisible = spec.visual.labelsVisible;
    const mode =
      spec.visual.mode === "natural"
        ? "自然外观示意，非实测影像"
        : "为便于教学已增强轮廓，不代表真实目视效果";
    const uncertain =
      spec.material.composition !== "pure"
        ? "；组分未确认，当前为通用教学效果"
        : "";
    const nextNote = `${spec.material.name} · 写实演示 / 非项目计算 · ${mode}${uncertain}${pressureVisible?' · 压力传播示意（非超压结果）':''}`;
    if (note.textContent !== nextNote) note.textContent = nextNote;
    host.dataset.sceneId = spec.sceneId;
    host.dataset.materialId = spec.material.id || "unconfirmed";
    host.dataset.visualMode = spec.visual.mode;
    if (!initialized) {
      initialized = true;
      setCamera("overview");
    } else draw();
  }
  const change = () => draw();
  const manual=()=>{activeCamera='free';};controls.addEventListener('start',manual);
  controls.addEventListener("change", change);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const lost = (event) => {
    event.preventDefault();
    contextLost = true;
    onFail("WebGL 已中断，已恢复 2D 教学；修改、保存与导出仍可使用。");
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    update,
    setCamera,
    reset() {
      return setCamera("overview");
    },
    setLabelsVisible(value) {
      labelsVisible = Boolean(value);
      updateLabels();
    },
    setLabelDetail(value){labelDetail=Boolean(value);updateLabels();},
    setQuality(value){if(!QUALITY_PROFILES[value])throw Error('画质档无效');quality=value;volume.setQuality(value);resize();},
    setCutaway(value){cutaway=Boolean(value);if(assembly&&spec)assembly.update(spec,frame,{cutaway});draw();},
    setPressureVisible(value){pressureVisible=Boolean(value);if(spec)update(spec,frame);else draw();},
    getCameraState(){return cameraState();},
    setOrbitAngle(degrees,elevation=23){
      const distance=camera.position.distanceTo(controls.target),az=degrees*Math.PI/180,el=elevation*Math.PI/180;
      camera.up.set(0,1,0);camera.position.copy(controls.target).add(new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(distance));controls.update();activeCamera='orbit';draw();
    },
    exportFrame(options={}){
      if(disposed||contextLost||!spec||!assembly?.group.visible)return Promise.reject(Error('当前3D场景不可导出'));
      const frozenSpec=structuredClone(spec),frozenFrame=structuredClone(frame),frozenCamera=camera.clone(),frozenLabels=structuredClone(assembly.labels),frozenDetail=labelDetail;
      const frozenImportant=frozenLabels.map((d,i)=>({d,i})).filter(({d})=>PRIMARY_LABEL_KEYS.has(d.key)||d.important).map(({i})=>i).slice(0,3);
      const metadata={material:{id:frozenSpec.material.id,name:frozenSpec.material.name},scenario:{id:frozenSpec.sceneId,name:frozenSpec.scenario?.name||frozenSpec.sceneId},assisted:frozenSpec.visual.mode!=='natural',appVersion:APP_VERSION,progress:frozenFrame.progress,seed:frozenFrame.seed??1,noiseTime:frozenFrame.noiseTime,inputRevision:frozenSpec.inputRevision,quality,renderer:volume.stats().renderer,camera:cameraState(),cutaway,pressureAux:pressureVisible,labelDetail:frozenDetail};
      return encodeFrame({...options,metadata,capture(width,height){
        const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect,savedTarget=renderer.getRenderTarget();
        try{
          renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();volume.resize(width,height,true);
          volume.render(scene,camera,frozenSpec,frozenFrame,{pressure:pressureVisible});
          const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(renderer.domElement,0,0);return canvas;
        }finally{
          renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);camera.aspect=aspect;camera.updateProjectionMatrix();const physical=renderer.getDrawingBufferSize(new THREE.Vector2());volume.resize(physical.x,physical.y);renderer.setRenderTarget(savedTarget);draw();
        }
      },labelSnapshot(width,height){
        frozenCamera.aspect=width/height;frozenCamera.updateProjectionMatrix();frozenCamera.updateMatrixWorld();
        return frozenLabels.map((d,i)=>{const projected=enu(d.point).project(frozenCamera);const active=!d.show||(d.show==='leak'&&frozenFrame.leakVisible)||(d.show==='pool'&&frozenFrame.poolVisible)||(d.show==='cloud'&&frozenFrame.cloudGrowth>0)||(d.show==='fire'&&frozenFrame.fireIntensity>0)||(d.show==='vent'&&frozenFrame.ventIntensity>0);return {text:d.text,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,visible:(frozenDetail||frozenImportant.includes(i))&&active&&projected.z>-1&&projected.z<1};});
      }});
    },
    stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      controls.removeEventListener("change", change);
      controls.removeEventListener('start',manual);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      removeAssembly();
      scene.clear();
      sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();
      volume.dispose();
      environment.dispose();
      renderer.dispose();
      liveRenderers--;
      host.replaceChildren();
      writeStats();
    },
  };
  function cameraState(){return {projection:'perspective',position:{x:camera.position.x,y:-camera.position.z,z:camera.position.y},target:{x:controls.target.x,y:-controls.target.z,z:controls.target.y},fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,preset:activeCamera};}
}

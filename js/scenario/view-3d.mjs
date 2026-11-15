import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { worldToThree } from "./coordinates.mjs";
import { createSceneAssembly } from "./three/scene-components.mjs";

let liveRenderers = 0;
const enu = (p) => new THREE.Vector3(...worldToThree(p));
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
    powerPreference: "low-power",
  });
  liveRenderers++;
  renderer.setClearColor(0xeaf0ec);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8ca197, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 12, 8);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xd4e9e1, 0.65);
  rim.position.set(-8, 6, -6);
  scene.add(rim);
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
    activeCamera = "overview";
  const counts = {
    createdGeometries: 0,
    disposedGeometries: 0,
    createdMaterials: 0,
    disposedMaterials: 0,
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
  };
  function stats() {
    return {
      ...counts,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      frames: frameCount,
      rendererCount: liveRenderers,
      activeLoops: 0,
      equipmentBuilds,
      sceneObjects: assembly ? assembly.group.children.length : 0,
      activeCamera,
      disposed,
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
        height = radius * 2.8 * Math.max(0.02, frame.fireGrowth || 0),
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
    for (let i = 0; i < labelNodes.length; i++) {
      const descriptor = assembly.labels[i],
        node = labelNodes[i],
        leader = leaderNodes[i];
      if (node.textContent !== descriptor.text)
        node.textContent = descriptor.text;
      const show =
        labelsVisible &&
        (!descriptor.show ||
          (descriptor.show === "leak" && frame.leakVisible) ||
          (descriptor.show === "pool" && frame.poolVisible));
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
    renderer.render(scene, camera);
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
      Math.min(window.devicePixelRatio || 1, w < 680 ? 1.25 : 1.75),
    );
    renderer.setSize(w, h, false);
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
      const anchor = name === "leak" ? a.leak : a.poolCenter;
      if (!anchor) return false;
      target = { ...anchor };
      if (name === "pool") {
        const visualHeight = Math.max(2.8, spec.pool.radiusM * 2.8);
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
      spec.sceneId !== "pool-fire" ||
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
    assembly.update(spec, frame);
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
    const nextNote = `${spec.material.name} · ${mode}${uncertain}。后果距离与发生频率尚未评估。`;
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
    stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      controls.removeEventListener("change", change);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      removeAssembly();
      scene.clear();
      renderer.dispose();
      liveRenderers--;
      host.replaceChildren();
      writeStats();
    },
  };
}

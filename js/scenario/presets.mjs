import { newProject, clone, validateProject } from "./schema.mjs";
export function materialById(c, id) {
  return c.chemicals.materials.find((x) => x.id === id);
}
export function equipmentById(c, id) {
  return c.equipment.equipment.find((x) => x.id === id);
}
export function setQuantity(p, basis, value) {
  const fields = {
    mass: "inventoryKg",
    volume: "volumeM3",
    fill: "fillFraction",
  };
  if (!fields[basis]) throw Error("库存主基准无效");
  p.inputs.storage.quantityBasis = basis;
  for (const f of Object.values(fields)) p.inputs.storage[f] = null;
  p.inputs.storage[fields[basis]] = value;
}
export function deriveQuantity(p) {
  const g = p.inputs.equipment.geometry,
    capacityM3 =
      g.orientation !== "generic" && g.diameterM !== null && g.heightM !== null
        ? (Math.PI * g.diameterM ** 2 * g.heightM) / 4
        : null,
    s = p.inputs.storage;
  const volumeM3 =
    s.quantityBasis === "volume"
      ? s.volumeM3
      : s.quantityBasis === "fill" &&
          s.fillFraction !== null &&
          capacityM3 !== null
        ? s.fillFraction * capacityM3
        : null;
  const fillFraction =
    s.quantityBasis === "fill"
      ? s.fillFraction
      : volumeM3 !== null && capacityM3 !== null
        ? volumeM3 / capacityM3
        : null;
  const liquidLevelM =
    g.orientation === "vertical" && fillFraction !== null && g.heightM !== null
      ? fillFraction * g.heightM
      : null;
  return {
    capacityM3,
    volumeM3,
    fillFraction,
    liquidLevelM,
    massKg: s.quantityBasis === "mass" ? s.inventoryKg : null,
    source: "教学圆筒几何推导；未使用密度，非工程容积或装填确认",
  };
}
export function bindMaterial(p, id, c) {
  const m = materialById(c, id);
  if (!m) throw Error("物料目录无此选项");
  const temp = p.inputs.material.temperatureK;
  p.inputs.material = {
    ...p.inputs.material,
    id: m.id,
    name: m.name,
    english: m.english || "",
    cas: m.cas,
    composition: m.composition || "unknown",
    state: m.state || "unknown",
    visualProfileRef: m.visualProfileRef || "generic",
    temperatureK: temp,
  };
  p.provenance["inputs.material.id"] = {
    kind: m.synthetic ? "teaching_assumption" : "public_identity_reference",
    presetRef: null,
    sourceRefs: m.sourceRefs || [],
  };
  p.provenance["inputs.material.cas"] = {
    kind: m.synthetic || !m.cas ? "legacy_record" : "public_identity_reference",
    presetRef: null,
    sourceRefs: m.sourceRefs || [],
  };
}
export function bindEquipment(p, id, c) {
  const e = equipmentById(c, id);
  if (!e) throw Error("设备目录无此选项");
  const prior = p.inputs.equipment.leakAnchor;
  p.inputs.equipment = {
    id: e.id,
    name: e.name,
    geometry: clone(e.geometry),
    containment: clone(e.containment),
    leakAnchor: e.leakAnchors.includes(prior) ? prior : null,
  };
  p.inputs.storage.equipment = e.name;
}
export function createPreset(c, id = "methanol-atmospheric-tank-pool-fire") {
  const t = c.presets.presets.find((x) => x.presetId === id);
  if (!t) throw Error("示例模板不存在");
  const p = newProject();
  p.meta.title = t.title;
  p.meta.presetId = t.presetId;
  p.meta.presetVersion = t.presetVersion;
  bindMaterial(p, t.materialRef, c);
  bindEquipment(p, t.equipmentRef, c);
  p.inputs.equipment.leakAnchor = t.leakAnchor;
  p.inputs.material.temperatureK = t.temperatureK;
  p.inputs.storage.pressurePa = t.pressurePa;
  p.inputs.storage.pressureMode = t.pressureMode;
  setQuantity(p, t.quantity.basis, t.quantity.value);
  p.inputs.scenario.id = t.scenarioId;
  p.inputs.scenario.ignition = "delayed_teaching";
  p.inputs.pool.radiusM = t.poolRadiusM;
  p.inputs.pool.geometrySource = "教学预设范围；未求解液池扩展";
  p.inputs.pool.ground = "示例排液路径关闭；需按现场核实";
  for (const k of ["liquid", "flammable", "pool", "ignition", "release"])
    p.inputs.scenario.conditions[k] = "yes";
  p.assumptions = t.assumptions.map((text) => ({
    text,
    source: `教学模板 ${t.presetId}@${t.presetVersion}`,
    confirmed: false,
  }));
  const ref = `${t.presetId}@${t.presetVersion}`;
  for (const field of [
    "inputs.material.temperatureK",
    "inputs.material.composition",
    "inputs.storage.volumeM3",
    "inputs.storage.pressurePa",
    "inputs.equipment.geometry.diameterM",
    "inputs.equipment.geometry.heightM",
    "inputs.pool.radiusM",
  ])
    p.provenance[field] = {
      kind: "teaching_assumption",
      presetRef: ref,
      sourceRefs: [],
    };
  return validateProject(p);
}

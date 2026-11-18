import { deriveQuantity, equipmentById } from "./presets.mjs";
import { CONDITION_LABELS } from "./schema.mjs";

export const COMPATIBLE_PRESETS = {
  "pool-fire": "methanol-atmospheric-tank-pool-fire",
  "jet-fire": "propane-gas-pipeline-jet-fire",
  "flash-fire": "propane-gas-pipeline-flash-fire",
  vce: "propane-gas-pipeline-vce",
  "confined-deflagration": "propane-cabinet-confined-deflagration",
};

export function checkCompatibility(p, c) {
  const issues = [], s = p.inputs.scenario, m = p.inputs.material,
    storage = p.inputs.storage, eq = equipmentById(c, p.inputs.equipment.id),
    definition = c.scenarios.scenarios.find((item) => item.id === s.id),
    pool = s.id === "pool-fire",
    detailedKind = Object.hasOwn(COMPATIBLE_PRESETS, s.id),
    gasProcess = detailedKind && !pool,
    geometryKind = eq?.geometryKind || (eq && eq.geometry.orientation !== "generic" ? "tank" : null),
    add = (code, field, message, action = detailedKind
      ? "保留当前物料、设备与工况；可单独载入兼容示例，不会自动替换。"
      : "保留资料并查看独立2D机制说明。") => issues.push({code,field,message,action});
  if (!detailedKind) add("MECHANISM_ONLY", "inputs.scenario.id",
    s.id === "bleve" ? "BLEVE仍提供独立2D机制；本轮未建立过热状态或容器失效3D模型。"
      : "毒性扩散仍提供独立2D机制；本轮未建立源项、风场或浓度3D模型。");
  if (m.composition !== "pure") add("IDENTITY_OR_COMPOSITION_UNCONFIRMED", "inputs.material.composition",
    "组分或配方未确认，不能沿用纯物料的特定燃烧外观。");
  const expectedPhase = pool ? "liquid" : gasProcess ? "gas" : null;
  if (expectedPhase && m.state !== expectedPhase) add("PHASE_UNCONFIRMED", "inputs.material.state",
    pool ? "液态教学前提未明确；未推断实际相态。" : "本详细示例需要气相输入假设；当前记录未确认，不能套用液化气库存。");
  if (!eq || p.inputs.equipment.id === "generic" || p.inputs.equipment.id === "unbound")
    add("EQUIPMENT_UNBOUND", "inputs.equipment.id", "设备未绑定有效教学模板，保留原文字资料。");
  const wanted = pool ? "tank" : s.id === "confined-deflagration" ? "cabinet" : "pipe-rack";
  if (detailedKind && geometryKind !== wanted) add("EQUIPMENT_PROCESS_MISMATCH", "inputs.equipment.id",
    `当前设备不匹配${definition?.name || s.id}的${wanted === "tank" ? "储罐" : wanted === "cabinet" ? "柜内空间" : "气相管线"}分镜。`);
  if (!p.inputs.equipment.leakAnchor || !eq?.leakAnchors.includes(p.inputs.equipment.leakAnchor))
    add("LEAK_ANCHOR_UNCONFIRMED", "inputs.equipment.leakAnchor", "泄漏点与当前设备不匹配，请选择有效锚点。");
  else if (pool && p.inputs.equipment.leakAnchor !== "valve-downstream")
    add("LEAK_STORYBOARD_NOT_INCLUDED", "inputs.equipment.leakAnchor", "此位置可记录；本版池火液流详细分镜仍以根部阀后短管为范围。");
  if (m.temperatureK === null || storage.pressurePa === null || storage.pressureMode === "unknown")
    add("STORAGE_UNCONFIRMED", "inputs.storage.pressurePa", "温度、绝对压力或压力基准尚未填写。");
  if (m.temperatureK !== null && (m.temperatureK < 273.15 || m.temperatureK > 313.15))
    add("OUTSIDE_TEACHING_CONFIGURATION", "inputs.material.temperatureK",
      "温度不在0–40°C视觉示例范围；保留输入，不能由此确认相态或判断事故不发生。");
  const pressure = storage.pressurePa;
  if (pool && pressure !== null && (pressure < 90000 || pressure > 120000))
    add("PRESSURE_OUTSIDE_TEACHING_CONFIGURATION", "inputs.storage.pressurePa",
      "压力不在池火近常压视觉示例范围；保留输入，需另行核实源项。");
  if (gasProcess && s.id !== "confined-deflagration" && pressure !== null && (pressure <= 120000 || pressure > 600000))
    add("PRESSURE_OUTSIDE_TEACHING_CONFIGURATION", "inputs.storage.pressurePa",
      "气相管线详细分镜仅配置0.12–0.60 MPa绝压教学范围；不是相态或安全压力校验。");
  if (gasProcess && s.id === "confined-deflagration" && pressure !== null && (pressure < 90000 || pressure > 120000))
    add("PRESSURE_OUTSIDE_TEACHING_CONFIGURATION", "inputs.storage.pressurePa",
      "柜内积聚示例按近常压设置；压力变化不自动生成柜体耐压或泄爆结论。");
  if (gasProcess && m.id !== "propane") add("GAS_VISUAL_CONFIGURATION_UNAVAILABLE", "inputs.material.id",
    "本轮气相详细分镜只配置丙烷身份；其他气体保留资料，不套用丙烷视觉过程。");
  if (gasProcess && storage.quantityBasis !== "mass") add("GAS_QUANTITY_BASIS_UNSUPPORTED", "inputs.storage.quantityBasis",
    "气相示例只记录质量供料边界；原体积或装填率已保留，但不用于气体液位或液体容积推导。");
  const primary = storage[{mass:"inventoryKg",volume:"volumeM3",fill:"fillFraction"}[storage.quantityBasis]];
  if (primary === null || primary === 0) add("QUANTITY_UNKNOWN_OR_EMPTY", "inputs.storage.quantityBasis",
    primary === 0 ? "当前记录为空供料/库存；详细教学前提未建立。" : "库存或供料主输入尚未填写。");
  if (detailedKind) for (const key of definition?.conditions || []) {
    if (s.conditions[key] !== "yes") add("SCENARIO_CONDITION_UNCONFIRMED", `inputs.scenario.conditions.${key}`,
      `“${definition?.name || s.id}”的前提“${CONDITION_LABELS[key] || key}”尚未确认；事故名称不会自动建立该条件。`);
  }
  if (pool) {
    const q = deriveQuantity(p), g = p.inputs.equipment.geometry,
      box = p.inputs.equipment.containment, r = p.inputs.pool.radiusM;
    if (q.volumeM3 !== null && q.capacityM3 !== null && q.volumeM3 > q.capacityM3)
      add("CAPACITY_EXCEEDED", "inputs.storage.volumeM3", "库存体积超过教学几何容量；保留输入，未自动截断。", "核对库存基准或设备几何。");
    if (r === null) add("POOL_PRESET_UNCONFIRMED", "inputs.pool.radiusM", "液池教学范围尚未填写。");
    if (g.diameterM !== null && r !== null && box.lengthM !== null && g.diameterM / 2 + 1.95 + r > box.lengthM / 2)
      add("POOL_OUTSIDE_CONTAINMENT", "inputs.pool.radiusM", "液池视觉预设超出围堰边界；未自动缩小以掩盖冲突。");
  }
  return {
    support: issues.length ? "mechanism_only" : "detailed_teaching", issues,
    canSave:true, canPlayDetailedStoryboard:issues.length === 0, canCalculate:false,
    suggestedPresetId: COMPATIBLE_PRESETS[s.id] || null,
    phaseVerification:"not_evaluated",
  };
}

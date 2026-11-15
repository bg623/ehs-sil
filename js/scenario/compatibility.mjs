import { deriveQuantity, equipmentById } from "./presets.mjs";
export function checkCompatibility(p, c) {
  const issues = [],
    add = (
      code,
      field,
      message,
      action = "可保留资料并观看机制说明，补齐条件后再查看详细示例。",
    ) => issues.push({ code, field, message, action });
  const q = deriveQuantity(p),
    s = p.inputs.scenario,
    eq = equipmentById(c, p.inputs.equipment.id);
  if (s.id !== "pool-fire")
    add(
      "MECHANISM_ONLY",
      "inputs.scenario.id",
      s.id === "bleve"
        ? "当前条件尚不足以建立 BLEVE 详细演示；需确认过热液体、容器失效与快速降压。"
        : "当前事故提供独立机制教学，尚未提供该事故的详细 3D。",
    );
  if (p.inputs.material.composition !== "pure")
    add(
      "IDENTITY_OR_COMPOSITION_UNCONFIRMED",
      "inputs.material.composition",
      "组分或配方未确认，不能沿用纯物料的特定燃烧外观。",
    );
  if (p.inputs.material.state !== "liquid")
    add(
      "PHASE_UNCONFIRMED",
      "inputs.material.state",
      "液态条件未明确，当前采用通用机制。",
    );
  if (!eq || p.inputs.equipment.id === "generic")
    add(
      "EQUIPMENT_UNBOUND",
      "inputs.equipment.id",
      "设备未绑定有效教学模板，保留原文字资料。",
    );
  if (
    !p.inputs.equipment.leakAnchor ||
    !eq?.leakAnchors.includes(p.inputs.equipment.leakAnchor)
  )
    add(
      "LEAK_ANCHOR_UNCONFIRMED",
      "inputs.equipment.leakAnchor",
      "旧泄漏点与当前设备不匹配，请选择有效泄漏位置。",
    );
  else if (p.inputs.equipment.leakAnchor !== "valve-downstream")
    add(
      "LEAK_STORYBOARD_NOT_INCLUDED",
      "inputs.equipment.leakAnchor",
      "该泄漏位置可记录；本版详细分镜仅实现根部阀后短管，当前使用机制教学。",
    );
  if (
    p.inputs.material.temperatureK === null ||
    p.inputs.storage.pressurePa === null
  )
    add(
      "STORAGE_UNCONFIRMED",
      "inputs.storage.pressurePa",
      "温度或绝对压力尚未填写。",
    );
  if (
    p.inputs.material.temperatureK !== null &&
    (p.inputs.material.temperatureK < 273.15 ||
      p.inputs.material.temperatureK > 313.15)
  )
    add(
      "OUTSIDE_TEACHING_CONFIGURATION",
      "inputs.material.temperatureK",
      "温度不在本版常温教学配置范围（0–40°C）；保留输入，不能由此推断真实相态或事故不发生。",
    );
  if (
    p.inputs.storage.pressurePa !== null &&
    (p.inputs.storage.pressurePa < 90000 ||
      p.inputs.storage.pressurePa > 120000)
  )
    add(
      "PRESSURE_OUTSIDE_TEACHING_CONFIGURATION",
      "inputs.storage.pressurePa",
      "压力不在本版近常压教学配置范围；保留输入，需另行确认受压释放机制。",
    );
  if (q.volumeM3 !== null && q.capacityM3 !== null && q.volumeM3 > q.capacityM3)
    add(
      "CAPACITY_EXCEEDED",
      "inputs.storage.volumeM3",
      "库存体积超过教学几何容量；输入保留，未自动截断。",
      "请核对库存主基准或设备几何。",
    );
  const primary =
    p.inputs.storage[
      { mass: "inventoryKg", volume: "volumeM3", fill: "fillFraction" }[
        p.inputs.storage.quantityBasis
      ]
    ];
  if (primary === null || primary === 0)
    add(
      "QUANTITY_UNKNOWN_OR_EMPTY",
      "inputs.storage.quantityBasis",
      primary === 0
        ? "当前记录为空库存；池火详细教学前提未建立。"
        : "库存主输入尚未填写。",
    );
  if (p.inputs.pool.radiusM === null)
    add(
      "POOL_PRESET_UNCONFIRMED",
      "inputs.pool.radiusM",
      "液池教学预设范围尚未填写。",
    );
  const g = p.inputs.equipment.geometry,
    box = p.inputs.equipment.containment,
    r = p.inputs.pool.radiusM;
  if (
    g.diameterM !== null &&
    r !== null &&
    box.lengthM !== null &&
    g.diameterM / 2 + 1.95 + r > box.lengthM / 2
  )
    add(
      "POOL_OUTSIDE_CONTAINMENT",
      "inputs.pool.radiusM",
      "当前教学液池预设范围超出围堰示意边界；未自动缩放以掩盖冲突。",
    );
  const detailed = issues.length === 0;
  return {
    support: detailed ? "detailed_teaching" : "mechanism_only",
    issues,
    canSave: true,
    canPlayDetailedStoryboard: detailed,
    canCalculate: false,
  };
}

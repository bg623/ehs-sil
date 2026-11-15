import { SCHEMA_VERSION } from "./version.mjs";
import { migrateProject } from "./migrations.mjs";
export {
  APP_VERSION,
  DATA_VERSION,
  SCHEMA_VERSION,
  MODEL_VERSION,
} from "./version.mjs";
export const CONDITION_LABELS = {
  liquid: "液态释放",
  flammable: "可燃介质",
  pool: "形成液池",
  ignition: "点火条件",
  pressurized: "有压持续喷放",
  release: "释放路径存在",
  cloud: "可燃云团形成",
  congestion: "拥塞 / 受限与火焰加速条件",
  superheated: "过热液体状态",
  vesselFailure: "容器失效与快速降压",
  toxic: "有毒介质",
  airborne: "物料进入空气",
};
export const SCENARIOS = [
  "pool-fire",
  "jet-fire",
  "flash-fire",
  "vce",
  "bleve",
  "toxic",
];
export const clone = (x) => JSON.parse(JSON.stringify(x));
export function newProject(example = false) {
  return {
    meta: {
      id: crypto.randomUUID(),
      title: example ? "池火教学示例" : "我的场景记录",
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      presetId: null,
      presetVersion: null,
    },
    inputRevision: 1,
    inputs: {
      material: {
        id: example ? "teaching-a" : null,
        name: example ? "教学液体 A" : "",
        english: "",
        cas: null,
        composition: "unknown",
        state: example ? "liquid" : "unknown",
        temperatureK: null,
        visualProfileRef: "generic",
      },
      storage: {
        equipment: "储罐",
        quantityBasis: "mass",
        inventoryKg: null,
        volumeM3: null,
        fillFraction: null,
        pressurePa: null,
        pressureMode: "unknown",
        note: "",
      },
      equipment: {
        id: "generic",
        name: "未绑定模板的设备",
        geometry: { diameterM: null, heightM: null, orientation: "generic" },
        containment: { lengthM: null, widthM: null, heightM: null },
        leakAnchor: null,
      },
      scenario: {
        id: "pool-fire",
        releaseKg: null,
        ignition: "unknown",
        conditions: Object.fromEntries(
          Object.keys(CONDITION_LABELS).map((k) => [
            k,
            example && ["liquid", "flammable", "pool", "ignition"].includes(k)
              ? "yes"
              : "unknown",
          ]),
        ),
      },
      pool: {
        areaM2: null,
        diameterM: null,
        radiusM: null,
        geometrySource: "",
        ground: "",
      },
      receptors: [],
    },
    controls: [],
    assumptions: [],
    evidenceNotes: "",
    comparison: null,
    provenance: {},
    scenarioMemory: {},
    migrationLog: [],
    ui: {
      view: "2d",
      stage: 0,
      visualMode: "assisted",
      camera: "overview",
      speed: 1,
      labels: true,
    },
  };
}
export const kgFromTonnes = (n) => (n === null ? null : n * 1000);
export const paFromKpa = (n) => (n === null ? null : n * 1000);
export const kelvinFromC = (n) => (n === null ? null : n + 273.15);
export function inspectValue(x, depth = 0) {
  if (depth > 20) throw Error("对象层级超过 20 层");
  if (typeof x === "number" && !Number.isFinite(x))
    throw Error("包含非有限数字");
  if (typeof x === "string" && x.length > 6000)
    throw Error("文字超过 6000 字符");
  if (Array.isArray(x) && x.length > 100) throw Error("列表超过 100 项");
  if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("不允许的对象键");
      inspectValue(v, depth + 1);
    }
}
export function shape(value, template, path = "project") {
  if (template === null) return;
  if (value === null || typeof value !== typeof template)
    throw Error(`${path} 类型错误`);
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) throw Error(`${path} 应为数组`);
    return;
  }
  if (typeof template === "object") {
    if (Array.isArray(value)) throw Error(`${path} 格式错误`);
    if (!Object.keys(template).length) return;
    for (const k of Object.keys(value))
      if (!Object.hasOwn(template, k)) throw Error(`${path}.${k} 不是支持字段`);
    for (const k of Object.keys(template)) {
      if (!Object.hasOwn(value, k)) throw Error(`${path}.${k} 缺失`);
      shape(value[k], template[k], `${path}.${k}`);
    }
  }
}
export function validateInputs(p) {
  const e = [],
    check = (field, n, min, max, inclusive = true) => {
      if (
        n !== null &&
        (typeof n !== "number" ||
          !Number.isFinite(n) ||
          (inclusive ? n < min : n <= min) ||
          n > max)
      )
        e.push({
          field,
          message: `${field} 请填写有效范围内的数字，或留空表示未填写。`,
        });
    };
  check("inventoryKg", p.inputs.storage.inventoryKg, 0, 1e12);
  check("volumeM3", p.inputs.storage.volumeM3, 0, 1e9);
  check("fillFraction", p.inputs.storage.fillFraction, 0, 1);
  check("pressurePa", p.inputs.storage.pressurePa, 0, 1e10, false);
  check("temperatureK", p.inputs.material.temperatureK, 0, 2000, false);
  check("releaseKg", p.inputs.scenario.releaseKg, 0, 1e12);
  for (const k of ["areaM2", "diameterM", "radiusM"])
    check(k, p.inputs.pool[k], 0, 1e8, false);
  for (const [k, v] of Object.entries(p.inputs.equipment.geometry))
    if (k !== "orientation") check(k, v, 0, 1000, false);
  for (const [k, v] of Object.entries(p.inputs.equipment.containment))
    check(`containment.${k}`, v, 0, 10000, false);
  const fields = {
      mass: "inventoryKg",
      volume: "volumeM3",
      fill: "fillFraction",
    },
    basis = p.inputs.storage.quantityBasis;
  if (!fields[basis])
    e.push({ field: "quantityBasis", message: "库存主基准无效" });
  else
    for (const k of Object.values(fields))
      if (k !== fields[basis] && p.inputs.storage[k] !== null)
        e.push({
          field: k,
          message: "库存仅允许一个主输入基准；其他值应为派生值而非独立输入。",
        });
  if (
    p.inputs.storage.inventoryKg !== null &&
    p.inputs.scenario.releaseKg !== null &&
    p.inputs.scenario.releaseKg > p.inputs.storage.inventoryKg
  )
    e.push({
      field: "releaseKg",
      message: "指定释放质量不能超过可用质量库存。",
    });
  return e;
}
export function validateProject(p, allowComparison = true) {
  inspectValue(p);
  shape(p, newProject());
  if (p.meta.schemaVersion !== SCHEMA_VERSION)
    throw Error("项目结构版本不支持");
  if (!Number.isInteger(p.inputRevision) || p.inputRevision < 1)
    throw Error("修订号无效");
  const enums = (v, a, label) => {
    if (!a.includes(v)) throw Error(`${label} 无效`);
  };
  enums(p.inputs.scenario.id, SCENARIOS, "事故类型");
  enums(p.inputs.material.composition, ["pure", "mixture", "unknown"], "组分");
  enums(p.inputs.material.state, ["liquid", "gas", "solid", "unknown"], "物态");
  enums(
    p.inputs.storage.pressureMode,
    ["atmospheric", "absolute", "unknown"],
    "压力基准",
  );
  enums(
    p.inputs.equipment.geometry.orientation,
    ["vertical", "horizontal", "generic"],
    "设备方向",
  );
  enums(p.ui.view, ["2d", "3d"], "视图");
  enums(p.ui.visualMode, ["assisted", "natural"], "显示模式");
  enums(p.ui.camera, ["overview", "tank", "leak", "pool", "top"], "镜头");
  if (
    !Number.isInteger(p.ui.stage) ||
    p.ui.stage < 0 ||
    p.ui.stage > 10 ||
    !Number.isFinite(p.ui.speed) ||
    p.ui.speed < 0.25 ||
    p.ui.speed > 3
  )
    throw Error("播放偏好无效");
  for (const k of ["id", "cas"])
    if (
      p.inputs.material[k] !== null &&
      typeof p.inputs.material[k] !== "string"
    )
      throw Error("物料身份格式无效");
  for (const k of ["presetId", "presetVersion"])
    if (p.meta[k] !== null && typeof p.meta[k] !== "string")
      throw Error("模板引用格式无效");
  if (
    p.inputs.equipment.leakAnchor !== null &&
    typeof p.inputs.equipment.leakAnchor !== "string"
  )
    throw Error("泄漏点无效");
  for (const v of Object.values(p.inputs.scenario.conditions))
    enums(v, ["yes", "no", "unknown"], "事故前提");
  for (const c of p.controls) {
    shape(
      c,
      {
        type: "",
        target: "",
        boundary: "",
        actionTimeS: null,
        evidence: "",
        status: "",
      },
      "control",
    );
    if (
      c.actionTimeS !== null &&
      (typeof c.actionTimeS !== "number" ||
        !Number.isFinite(c.actionTimeS) ||
        c.actionTimeS < 0)
    )
      throw Error("措施动作时间无效");
  }
  for (const a of p.assumptions)
    shape(a, { text: "", source: "", confirmed: false }, "assumption");
  for (const r of p.inputs.receptors) {
    shape(r, { id: "", x: 0, y: 0, z: 0 }, "receptor");
    if (![r.x, r.y, r.z].every(Number.isFinite)) throw Error("目标坐标无效");
  }
  if (Object.keys(p.provenance).length > 100) throw Error("来源项过多");
  const template = newProject();
  for (const [k, v] of Object.entries(p.provenance)) {
    let x = template;
    for (const part of k.split(".")) {
      if (!x || typeof x !== "object" || !Object.hasOwn(x, part))
        throw Error("来源路径不属于项目结构");
      x = x[part];
    }
    shape(v, { kind: "", presetRef: null, sourceRefs: [] }, "provenance");
    enums(
      v.kind,
      [
        "teaching_assumption",
        "public_identity_reference",
        "user_input",
        "migrated",
        "legacy_record",
      ],
      "来源类型",
    );
    if (v.presetRef !== null && typeof v.presetRef !== "string")
      throw Error("来源模板格式无效");
    if (v.sourceRefs.some((x) => typeof x !== "string"))
      throw Error("来源引用无效");
  }
  for (const [k, v] of Object.entries(p.scenarioMemory)) {
    enums(k, SCENARIOS, "场景记忆");
    shape(v, template.inputs.scenario);
    if (v.id !== k) throw Error("场景记忆标识不一致");
    for (const x of Object.values(v.conditions))
      enums(x, ["yes", "no", "unknown"], "场景记忆条件");
    if (
      v.releaseKg !== null &&
      (typeof v.releaseKg !== "number" || v.releaseKg < 0)
    )
      throw Error("场景记忆释放量无效");
  }
  if (p.migrationLog.some((x) => typeof x !== "string"))
    throw Error("迁移记录无效");
  const errors = validateInputs(p);
  if (errors.length) throw Error(errors[0].message);
  if (p.comparison !== null) {
    if (!allowComparison) throw Error("不允许嵌套比较");
    shape(p.comparison, {
      project: {},
      modelVersion: "",
      dataVersion: "",
      inputRevision: 0,
    });
    validateProject(p.comparison.project, false);
  }
  return p;
}
export function stripClaims(raw) {
  if (!raw || typeof raw !== "object") throw Error("项目应为对象");
  for (const k of ["result", "resultSummary", "reviewStatus", "approved"])
    delete raw[k];
  if (raw.comparison?.project) stripClaims(raw.comparison.project);
  return raw;
}
export function parseProjectText(text) {
  if (new TextEncoder().encode(text).length > 1048576)
    throw Error("文件超过 1 MiB");
  const raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  inspectValue(raw);
  stripClaims(raw);
  const { project } = migrateProject(raw);
  validateProject(project);
  return project;
}
export const parseProject = parseProjectText;
export function canonicalInputs(p) {
  const stable = (x) =>
    Array.isArray(x)
      ? x.map(stable)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, stable(x[k])]),
          )
        : x;
  return JSON.stringify(
    stable({
      inputs: p.inputs,
      controls: p.controls,
      assumptions: p.assumptions,
      evidenceNotes: p.evidenceNotes,
    }),
  );
}
export async function inputHash(p) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalInputs(p)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

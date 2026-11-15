import {
  newProject,
  clone,
  shape,
  inspectValue,
  stripClaims,
} from "./schema.mjs";
import { SCHEMA_VERSION } from "./version.mjs";
export function migrateProject(raw) {
  inspectValue(raw);
  const old = stripClaims(clone(raw));
  if (old.meta?.schemaVersion === SCHEMA_VERSION)
    return { project: old, log: [] };
  if (old.meta?.schemaVersion !== "1.0.0")
    throw Error("项目结构版本不支持，原文件保持不变");
  const legacy = newProject();
  for (const k of ["presetId", "presetVersion"]) delete legacy.meta[k];
  for (const k of ["english", "visualProfileRef"])
    delete legacy.inputs.material[k];
  for (const k of ["quantityBasis", "volumeM3", "fillFraction", "pressureMode"])
    delete legacy.inputs.storage[k];
  delete legacy.inputs.equipment;
  delete legacy.inputs.pool.radiusM;
  for (const k of ["provenance", "scenarioMemory", "migrationLog"])
    delete legacy[k];
  for (const k of ["visualMode", "camera", "speed", "labels"])
    delete legacy.ui[k];
  shape(old, legacy);
  const p = newProject();
  Object.assign(p.meta, old.meta, { schemaVersion: SCHEMA_VERSION });
  p.inputRevision = old.inputRevision;
  p.inputs.material = { ...p.inputs.material, ...old.inputs.material };
  p.inputs.storage = {
    ...p.inputs.storage,
    ...old.inputs.storage,
    quantityBasis: "mass",
  };
  p.inputs.equipment.name = old.inputs.storage.equipment || "未绑定模板的设备";
  p.inputs.pool = { ...p.inputs.pool, ...old.inputs.pool };
  p.inputs.scenario = clone(old.inputs.scenario);
  p.inputs.receptors = clone(old.inputs.receptors);
  for (const k of ["controls", "assumptions", "evidenceNotes"])
    p[k] = clone(old[k]);
  p.ui = { ...p.ui, ...old.ui };
  if (old.comparison) {
    shape(old.comparison, {
      project: {},
      modelVersion: "",
      dataVersion: "",
      inputRevision: 0,
    });
    p.comparison = {
      ...old.comparison,
      project: migrateProject(old.comparison.project).project,
    };
  }
  p.provenance["inputs.storage.inventoryKg"] = {
    kind: "migrated",
    presetRef: null,
    sourceRefs: [],
  };
  p.provenance["inputs.material.id"] = {
    kind: "legacy_record",
    presetRef: null,
    sourceRefs: [],
  };
  const log = [
    "从 1.0.0 迁移为 1.1.0；保留原物料身份、质量基准、设备文字、备注及冻结 A；未推断密度或甲醇身份。",
  ];
  p.migrationLog = log;
  return { project: p, log };
}

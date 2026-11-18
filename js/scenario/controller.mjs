import {
  clone,
  validateProject,
  SCENARIOS,
  canonicalInputs,
} from "./schema.mjs";
import {
  bindMaterial,
  bindEquipment,
  setQuantity,
  createPreset,
} from "./presets.mjs";
import { checkCompatibility } from "./compatibility.mjs";
function patchAt(p, path, value) {
  if (
    !/^(inputs\.|meta\.title$|evidenceNotes$|controls$|assumptions$)/.test(path)
  )
    throw Error("不允许修改此字段");
  const parts = path.split(".");
  let node = p;
  for (const k of parts.slice(0, -1)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(k) ||
      !Object.hasOwn(node, k)
    )
      throw Error("字段路径无效");
    node = node[k];
  }
  const k = parts.at(-1);
  if (
    ["__proto__", "constructor", "prototype"].includes(k) ||
    !Object.hasOwn(node, k)
  )
    throw Error("字段路径无效");
  if (JSON.stringify(node[k]) === JSON.stringify(value)) return;
  node[k] = clone(value);
  p.provenance[path] = { kind: "user_input", presetRef: null, sourceRefs: [] };
}
export function previewChange(project, command, c) {
  let p = clone(project);
  const summary = { kept: [], updated: [], confirm: [] };
  switch (command.type) {
    case "batch":
      for (const sub of command.commands) {
        if (sub.type === "batch") throw Error("不允许嵌套事务");
        const part = previewChange(p, sub, c);
        p = part.project;
        for (const k of ["kept", "updated", "confirm"])
          summary[k].push(...part.summary[k]);
      }
      break;
    case "material": {
      const oldName = p.inputs.material.name;
      bindMaterial(p, command.id, c);
      if (command.id !== project.inputs.material.id) {
        p.assumptions = p.assumptions.map((a) =>
          a.source.startsWith("教学模板") && oldName && a.text.includes(oldName)
            ? {
                text: `原模板物料假设已失效，需按当前${p.inputs.material.name}重新核实组分与外观。`,
                source: "换料后待复核",
                confirmed: false,
              }
            : a,
        );
      }
      summary.kept = [
        "设备与围堰",
        "库存主输入与单位",
        "温压与事故类型",
        "冻结方案 A",
      ];
      summary.updated = ["物料身份、来源与教学外观"];
      break;
    }
    case "equipment":
      bindEquipment(p, command.id, c);
      if (Object.hasOwn(command, "leakAnchor"))
        p.inputs.equipment.leakAnchor = command.leakAnchor;
      summary.kept = ["物料", "库存主输入", "温压与事故类型", "冻结方案 A"];
      summary.updated = ["设备教学几何与容量"];
      if (!p.inputs.equipment.leakAnchor)
        summary.confirm.push("请选择新设备的有效泄漏点");
      break;
    case "storage": {
      const s = command.patch;
      if (
        Object.hasOwn(s, "quantityBasis") ||
        Object.hasOwn(s, "quantityValue")
      )
        setQuantity(
          p,
          s.quantityBasis || p.inputs.storage.quantityBasis,
          Object.hasOwn(s, "quantityValue") ? s.quantityValue : null,
        );
      if (Object.hasOwn(s, "temperatureK"))
        p.inputs.material.temperatureK = s.temperatureK;
      for (const k of ["pressurePa", "pressureMode"])
        if (Object.hasOwn(s, k)) p.inputs.storage[k] = s[k];
      summary.kept = ["物料、设备与事故", "围堰与泄漏点", "冻结方案 A"];
      summary.updated = ["库存主基准及储存条件"];
      for (const path of [
        "inputs.storage.quantityBasis",
        "inputs.storage.inventoryKg",
        "inputs.storage.volumeM3",
        "inputs.storage.fillFraction",
        "inputs.material.temperatureK",
        "inputs.storage.pressurePa",
      ]) {
        const read = (obj) => path.split(".").reduce((a, k) => a[k], obj);
        if (JSON.stringify(read(project)) !== JSON.stringify(read(p)))
          p.provenance[path] = {
            kind: "user_input",
            presetRef: null,
            sourceRefs: [],
          };
      }
      break;
    }
    case "scenario":
      if (!SCENARIOS.includes(command.id)) throw Error("事故类型无效");
      p.scenarioMemory[p.inputs.scenario.id] = clone(p.inputs.scenario);
      p.inputs.scenario = p.scenarioMemory[command.id]
        ? clone(p.scenarioMemory[command.id])
        : {
            ...clone(p.inputs.scenario),
            id: command.id,
            releaseKg: null,
            ignition: "unknown",
            conditions: Object.fromEntries(
              Object.keys(p.inputs.scenario.conditions).map((k) => [
                k,
                "unknown",
              ]),
            ),
          };
      summary.kept = ["物料、设备、库存与温压", "围堰与冻结方案 A"];
      summary.updated = ["当前事故机制及独立分镜"];
      break;
    case "preset": {
      const next = createPreset(c, command.id);
      next.comparison = clone(p.comparison);
      next.meta.id = p.meta.id;
      next.meta.createdAt = p.meta.createdAt;
      p = next;
      summary.kept = ["原草稿备份", "冻结方案 A"];
      summary.updated = ["整套教学示例"];
      break;
    }
    case "patch":
      for (const [k, v] of Object.entries(command.patch)) patchAt(p, k, v);
      summary.kept = ["未修改字段", "冻结方案 A"];
      summary.updated = ["所列字段"];
      break;
    default:
      throw Error("不支持的修改命令");
  }
  if (
    ["material", "equipment", "scenario"].includes(command.type) &&
    command.id !==
      (command.type === "material"
        ? project.inputs.material.id
        : command.type === "equipment"
          ? project.inputs.equipment.id
          : project.inputs.scenario.id) &&
    p.meta.presetId &&
    p.provenance["meta.title"]?.kind !== "user_input"
  ) {
    const d = c.scenarios.scenarios.find((s) => s.id === p.inputs.scenario.id);
    p.meta.title = `${p.inputs.material.name} · ${d.name}教学场景`;
  }
  p.inputRevision = project.inputRevision;
  validateProject(p);
  const support = checkCompatibility(p, c);
  summary.confirm.push(...support.issues.map((x) => x.message));
  return { project: p, summary, issues: support.issues };
}
export function applyChange(project, command, c) {
  const candidate = previewChange(project, command, c),
    changed =
      canonicalInputs(candidate.project) !== canonicalInputs(project) ||
      candidate.project.meta.title !== project.meta.title;
  candidate.project.inputRevision = project.inputRevision + (changed ? 1 : 0);
  candidate.project.meta.updatedAt = new Date().toISOString();
  candidate.project.ui.stage = 0;
  return { ...candidate, changed, previous: clone(project) };
}
export function undoLastChange(current, previous) {
  if (!previous) throw Error("没有可撤销的修改");
  const p = clone(previous);
  p.inputRevision = current.inputRevision + 1;
  p.meta.updatedAt = new Date().toISOString();
  p.ui.stage = 0;
  return validateProject(p);
}

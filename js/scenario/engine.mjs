import {
  APP_VERSION,
  DATA_VERSION,
  SCHEMA_VERSION,
  MODEL_VERSION,
  clone,
  inputHash,
  validateProject,
} from "./schema.mjs";
import { checkConditions } from "./scenario-rules.mjs";
export function acceptsResult(result, active, project) {
  return (
    result.calculationId === active &&
    result.inputRevision === project.inputRevision
  );
}
export async function assess(
  project,
  definition,
  calculationId = crypto.randomUUID(),
) {
  validateProject(project);
  const inputSnapshot = clone(project);
  inputSnapshot.comparison = null;
  const unevaluated = (unit, reasonCode) => ({
    status: "not_evaluated",
    value: null,
    unit,
    reasonCode,
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    calculationId,
    inputRevision: project.inputRevision,
    inputHash: await inputHash(project),
    assessmentKind: "teaching",
    status: "teaching_only",
    model: {
      id:
        definition.id === "pool-fire"
          ? "pool-fire-teaching"
          : `${definition.id}-mechanism-teaching`,
      version: MODEL_VERSION,
      dataVersion: DATA_VERSION,
    },
    inputSnapshot,
    conditions: checkConditions(project, definition),
    outputs: {
      thermalRadiation: unevaluated("kW/m2", "TEACHING_ONLY"),
      duration: unevaluated("s", "NO_REVIEWED_PROPERTIES"),
      overpressure: unevaluated("Pa", "MODEL_NOT_INCLUDED"),
      concentration: unevaluated("kg/m3", "MODEL_NOT_INCLUDED"),
      annualFrequency: unevaluated("1/year", "FREQUENCY_MODEL_NOT_INCLUDED"),
      individualRisk: unevaluated("1/year", "RISK_MODEL_NOT_INCLUDED"),
    },
    visualization: {
      kind: "qualitative",
      coordinateSystem: "local-east-north-up",
      lengthUnit: "m",
      timeBasis: "teaching_progress",
      effectContours: [],
      sceneId: definition.id,
      receptors: clone(project.inputs.receptors),
    },
    assumptions: clone(project.assumptions),
    controls: project.controls.map((c) => ({
      ...clone(c),
      status: "recorded_only",
      explanation: "已记录；本教学版不计入工程数值或可靠性折减。",
    })),
    limitations: [
      "仅教学演示；未评估工程影响距离、事故频率及个人风险。",
      "未取得真实物性、池火验证算例、近场适用边界及本实现的专业技术评审。",
      "图形无工程测量比例，演示阶段不是真实事故时间。",
    ],
    parameterEffects: [
      {
        fields: ["scenario.id", "scenario.conditions"],
        effect: "仅影响机制与条件检查",
      },
      {
        fields: [
          "material",
          "storage",
          "pool",
          "receptors",
          "controls",
          "assumptions",
        ],
        effect: "资料记录 / 教学；未参与定量后果计算",
      },
    ],
    sourceRefs: ["noaa-technical", "synthetic-math"],
  };
}
export function freezeA(project, result) {
  if (
    !result ||
    result.status === "stale" ||
    result.inputRevision !== project.inputRevision
  )
    throw Error("请先检查当前输入，再冻结 A");
  const p = clone(project);
  p.comparison = null;
  return {
    project: p,
    modelVersion: result.model.version,
    dataVersion: result.model.dataVersion,
    inputRevision: project.inputRevision,
  };
}
export function compare(a, b) {
  if (!a)
    return {
      compatible: false,
      differences: [],
      message: "先冻结 A，再编辑当前方案 B。",
    };
  const compatible =
    a.modelVersion === MODEL_VERSION &&
    ["scenario-data-0.1.0", "scenario-data-0.1.1", DATA_VERSION].includes(a.dataVersion);
  const flatten = (x, p = "", out = {}) => {
    if (x && typeof x === "object" && !Array.isArray(x))
      for (const [k, v] of Object.entries(x))
        flatten(v, p ? `${p}.${k}` : k, out);
    else out[p] = JSON.stringify(x);
    return out;
  };
  const aa = flatten({
      inputs: a.project.inputs,
      controls: a.project.controls,
      assumptions: a.project.assumptions,
      evidenceNotes: a.project.evidenceNotes,
    }),
    bb = flatten({
      inputs: b.inputs,
      controls: b.controls,
      assumptions: b.assumptions,
      evidenceNotes: b.evidenceNotes,
    });
  return {
    compatible,
    numericalComparable: false,
    differences: [...new Set([...Object.keys(aa), ...Object.keys(bb)])]
      .filter((k) => aa[k] !== bb[k])
      .map((k) => ({ field: k, a: aa[k] ?? "未填", b: bb[k] ?? "未填" })),
    message: compatible
      ? "教学条件可比较；后果数值未评估。"
      : "条件可比较，数值不可比较；冻结 A 已保留，请分别复核版本与依据。",
  };
}

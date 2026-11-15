import {
  APP_VERSION,
  SCHEMA_VERSION,
  DATA_VERSION,
  MODEL_VERSION,
  CONDITION_LABELS,
} from "./schema.mjs";
import { compare } from "./engine.mjs";
import { buildSceneSpec, sampleStoryboard } from "./scene-spec.mjs";
import { deriveQuantity } from "./presets.mjs";
import { escape, sceneSvg } from "./view-2d.mjs";
export function currentResult(p, r) {
  return r && r.inputRevision === p.inputRevision && r.status !== "stale"
    ? r
    : null;
}
export function safeCell(x) {
  const s = String(x ?? "未填写");
  return (
    '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'
  );
}
const terms = {
  unknown: "未填写 / unknown",
  yes: "条件存在 / yes",
  no: "当前不满足 / no",
  pure: "单一纯物料 / pure",
  mixture: "混合物 / mixture",
  liquid: "液体 / liquid",
  gas: "气体 / gas",
  solid: "固体 / solid",
  mass: "质量 / mass",
  volume: "体积 / volume",
  fill: "装填率 / fill",
};
const label = (x) => terms[x] || x;
export function rows(p, r, c) {
  r = currentResult(p, r);
  const s = p.inputs.storage,
    m = p.inputs.material,
    e = p.inputs.equipment,
    q = deriveQuantity(p),
    definition = c?.scenarios.scenarios.find(
      (x) => x.id === p.inputs.scenario.id,
    ),
    mode =
      p.ui.visualMode === "natural"
        ? "自然外观示意：外观示意，非实测影像"
        : "火焰可见性辅助：为便于教学已增强轮廓，不代表真实目视效果";
  const list = [
    ["类型", "字段", "值", "单位 / 用途"],
    ["版本", "应用", APP_VERSION, "教学试用"],
    ["版本", "项目结构", SCHEMA_VERSION, ""],
    ["版本", "资料目录", DATA_VERSION, "仅身份 / 教学"],
    [
      "版本",
      "模板",
      `${p.meta.presetId || "未绑定"} @ ${p.meta.presetVersion || "未绑定"}`,
      "原始模板引用，用户修改见当前输入",
    ],
    ["版本", "物料外观引用", m.visualProfileRef, "原目录引用，不等于当前使用"],
    ["版本", "实际视觉规则", c ? `${buildSceneSpec(p,c).visual.profile.id} @ ${buildSceneSpec(p,c).visual.profile.version}` : '未确认', "视觉参数不是工程物性"],
    ["版本", "数学组件", MODEL_VERSION, "未开放项目数值"],
    ["结果", "状态", r ? "仅教学检查" : "待检查 / 待重算", "工程量均未评估"],
    ["结果", "修订号", p.inputRevision, ""],
    [
      "场景",
      "当前事故",
      `${definition?.name || p.inputs.scenario.id} / ${p.inputs.scenario.id}`,
      "机制教学",
    ],
    ["记录", "标题", p.meta.title, ""],
    [
      "物料",
      "中文 / English",
      `${m.name} / ${m.english}`,
      "公开身份引用不等于工程审核",
    ],
    ["物料", "CAS", m.cas, "身份记录"],
    ["物料", "组分", label(m.composition), "仅记录"],
    ["物料", "物态", label(m.state), "需按实际工况确认"],
    ["设备", "储罐类型", e.name, "教学模板"],
    ["储存", "原始说明", s.note, "仅记录"],
    ["释放", "指定释放质量", p.inputs.scenario.releaseKg, "kg；未建立源项计算"],
    ["点火", "假设记录", p.inputs.scenario.ignition, "非概率或实际时间"],
    [
      "设备",
      "直径 / 高度",
      `${e.geometry.diameterM ?? "未填写"} / ${e.geometry.heightM ?? "未填写"}`,
      "m；仅示意",
    ],
    ["库存", "主输入基准", label(s.quantityBasis), "只允许一个主输入"],
    ["库存", "质量", s.inventoryKg, "kg；主输入时使用"],
    ["库存", "体积", s.volumeM3, "m³；主输入时使用"],
    ["库存", "装填率", s.fillFraction, "fraction；主输入时使用"],
    ["示意派生", "圆筒几何容量", q.capacityM3, "m³；非设计确认"],
    [
      "示意派生",
      "体积 / 液位",
      `${q.volumeM3 ?? "未填写"} / ${q.liquidLevelM ?? "未填写"}`,
      "m³ / m；无密度转换",
    ],
    ["工况", "储存温度", m.temperatureK, "K；仅记录"],
    ["工况", "绝对压力", s.pressurePa, "Pa；仅记录"],
    ["工况", "压力基准", s.pressureMode, "常压示例 / absolute"],
    [
      "围堰",
      "内部长 / 宽 / 高",
      `${e.containment.lengthM ?? "未填写"} / ${e.containment.widthM ?? "未填写"} / ${e.containment.heightM ?? "未填写"}`,
      "m；不评定合规容积",
    ],
    ["泄漏", "位置", e.leakAnchor, "仅记录 / 教学锚点"],
    ["液池", "预设半径", p.inputs.pool.radiusM, "m；教学配置，非计算范围"],
    ["液池", "几何依据", p.inputs.pool.geometrySource, ""],
    ["液池", "地面与排液说明", p.inputs.pool.ground, "仅记录"],
    ["显示", "当前模式", mode, "非实测影像 / 非热像"],
    ["资料", "说明", p.evidenceNotes, ""],
  ];
  if (r)
    list.push(
      ["结果", "当前输入哈希", r.inputHash, "复现关联，不是签章"],
      [
        "结果",
        "执行的教学检查",
        r.model.id + " @ " + r.model.version,
        "不是数值模型审定",
      ],
    );
  else
    list.push([
      "结果",
      "执行状态",
      "未执行当前可信检查",
      "RECALCULATION_REQUIRED；无旧哈希",
    ]);
  for (const [k, v] of Object.entries(p.inputs.scenario.conditions))
    list.push([
      "条件",
      `${CONDITION_LABELS[k]} / ${k}`,
      label(v),
      "用户或模板前提，需人工核实",
    ]);
  for (const a of p.assumptions)
    list.push([
      "假设",
      a.text,
      a.source,
      a.confirmed ? "用户已确认" : "待复核",
    ]);
  for (const ctrl of p.controls)
    list.push([
      "措施",
      ctrl.type,
      `${ctrl.target}；边界 ${ctrl.boundary}；动作时间 ${ctrl.actionTimeS ?? "未填写"} s；证据 ${ctrl.evidence}`,
      "仅记录 / recorded_only",
    ]);
  for (const target of p.inputs.receptors)
    list.push([
      "目标点",
      target.id,
      `东 ${target.x} / 北 ${target.y} / 上 ${target.z}`,
      "m；未求解暴露",
    ]);
  for (const key of [
    "热辐射",
    "超压",
    "毒性浓度",
    "燃烧持续时间",
    "事故年频率",
    "个人风险 / F–N",
  ])
    list.push(["后果", key, "未评估 / not_evaluated", "无工程数值"]);
  for (const [k, v] of Object.entries(p.provenance))
    list.push([
      "字段来源",
      k,
      `${v.kind}；${v.presetRef || ""}；${v.sourceRefs.join(", ")}`,
      "来源不改变技术审核状态",
    ]);
  if (p.comparison) {
    list.push([
      "方案 A",
      "物料 / 事故",
      `${p.comparison.project.inputs.material.name} / ${p.comparison.project.inputs.scenario.id}`,
      "冻结条件，不随 B 改变",
    ]);
    for (const diff of compare(p.comparison, p).differences)
      list.push([
        "A/B 差异",
        diff.field,
        `${diff.a} → ${diff.b}`,
        "条件比较；数值未评估",
      ]);
  }
  return list;
}
export const csv = (p, r, c) =>
  "\uFEFF" +
  rows(p, r, c)
    .map((row) => row.map(safeCell).join(","))
    .join("\r\n");
export function report(p, r, c, selectedFrame) {
  const spec = buildSceneSpec(p, c),
    valid = currentResult(p, r),
    frame =
      selectedFrame ||
      sampleStoryboard(spec, spec.support.canPlayDetailedStoryboard ? 0.62 : 0),
    table = rows(p, valid, c);
  const currentTitle = `${spec.material.name} / ${spec.scenario.name}`;
  const sourceIds = new Set([
      ...(c.chemicals.materials.find((m) => m.id === p.inputs.material.id)
        ?.sourceRefs || []),
      ...(spec.visual.profile.sourceRefs || []),
    ]),
    sources = c.sources.sources.filter((s) => sourceIds.has(s.id));
  return `<header><p>EHS-SIL · V${APP_VERSION} 教学试用版</p><h1>事故场景与后果模拟底稿</h1><h2>${escape(currentTitle)}</h2><p>记录：${escape(p.meta.title)}</p><p>${valid ? "仅教学演示" : "待检查 / 待重算：仅导出当前条件与教学图，无旧结果或旧哈希"} · ${escape(new Date().toISOString())}</p></header>${sceneSvg(spec, frame)}<p>${escape(spec.visual.note)}</p><p>${escape(spec.support.issues.map((i) => i.message).join("；"))}</p><table><thead><tr>${table[0].map((s) => `<th>${escape(s)}</th>`).join("")}</tr></thead><tbody>${table
    .slice(1)
    .map(
      (row) =>
        "<tr>" + row.map((v) => `<td>${escape(v)}</td>`).join("") + "</tr>",
    )
    .join(
      "",
    )}</tbody></table><h2>范围与未评估项</h2><p>设备尺寸与液池是教学配置，火焰轮廓不是工程影响边界。演示进度不是真实事故时间。工程后果、频率与风险量均未评估。</p><h2>来源与版本</h2><p>数据 ${DATA_VERSION}；${escape(spec.visual.profile.id)} @ ${escape(spec.visual.profile.version)}。物料身份与视觉特征有参考来源，不等于已审核工程物性或模型。</p><ul>${sources.map((s) => `<li>${escape(s.title)}；${escape(s.section || s.locator || "")}；${escape(s.url || "")}；访问 ${escape(s.accessedAt || s.checked || "见来源清单")}</li>`).join("")}</ul><p>专业审核与数值算法状态维持原样，technicalReview=null，screeningEnabled=false。本底稿不构成批准、工程审查或合规结论。</p>`;
}
export function download(text, type, extension) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = `EHS-SIL_scenario_${new Date().toISOString().slice(0, 10)}.${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

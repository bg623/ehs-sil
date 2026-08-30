import {
  calculateExposureRatios, calculateMeasuredGrade, calculateThi,
  collectRedFlags, determineControlApproach, mapHazardClassifications,
  mapHazardDegreeToWd, selectMaxExposureRatio
} from "./chemical-risk-engine.mjs";

const STORAGE_KEY = "ehs_sil_chemical_risk_matrix_v1";
const ARRAY_FIELDS = new Set(["ghsClassifications", "exposureRoutes", "physicalFlags", "outsideScopeFlags", "controls"]);
const BOOLEAN_FIELDS = new Set(["highToxic", "acuteToxicityCat1", "useThi", "sampleCompliant", "hasOel", "cmr", "sensitizer", "skinAbsorption", "corrosive"]);
const THI_ITEMS = [
  ["acuteInhalation", "急性吸入毒性（无吸入数据时按标准规则使用经口数据）", 5],
  ["dermal", "急性经皮毒性", 2],
  ["irritation", "皮肤 / 眼刺激与腐蚀性", 3],
  ["sensitisation", "致敏性", 3],
  ["reproductiveToxicity", "生殖毒性 / 生殖细胞致突变性", 3],
  ["carcinogenicity", "致癌性（IARC 证据）", 5],
  ["dispersion", "扩散性", 3],
  ["accumulation", "蓄积性", 1]
];
const CONSERVATIVE_KEYS = new Set(["accumulation", "carcinogenicity", "sensitisation", "reproductiveToxicity"]);
const DEGREE_LABELS = { light: "轻度危害", moderate: "中度危害", high: "高度危害", extreme: "极度危害" };
const GRADE_LABELS = { "0": "0级 · 相对无害作业", I: "Ⅰ级 · 轻度危害作业", II: "Ⅱ级 · 中度危害作业", III: "Ⅲ级 · 重度危害作业" };
const CONTROL_LABELS = { substitution: "消除 / 替代", enclosure: "密闭 / 隔离", lev: "局部排风", ventilation: "一般通风", maintenance: "维护检查", training: "告知与培训", ppe: "PPE", emergency: "冲洗 / 泄漏应急" };

let controlConfig;
let methodsConfig;
let state = { step: 1, values: { hasOel: true, unit: "mg/m³", limitUnit: "mg/m³", laborIntensity: "1", mixture: "false" }, result: null };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function track(name, extra = {}) {
  if (!window.EhsSilAnalytics) return;
  window.EhsSilAnalytics.track(name, {
    toolId: "chemical-risk-matrix", pageType: "other", sourceChannel: "site",
    contentId: extra.contentId || ""
  });
}

function hydrate() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.methodVersion === "CRM-2026.08-v1" && saved.values) {
      state = { step: Math.min(6, Math.max(1, Number(saved.step) || 1)), values: { ...state.values, ...saved.values }, result: saved.result || null };
      $("#saveStatus").textContent = "已恢复本机草稿";
    }
  } catch (_) {
    $("#saveStatus").textContent = "草稿读取失败";
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ methodVersion: "CRM-2026.08-v1", step: state.step, values: state.values, result: state.result, updatedAt: new Date().toISOString() }));
  $("#saveStatus").textContent = `已保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderDynamicFields() {
  $("#ghsOptions").innerHTML = controlConfig.hazardClassifications.map((item) => `<label><input type="checkbox" data-field="ghsClassifications" value="${esc(item.id)}">${esc(item.label)}${item.skin ? " · S" : ""}</label>`).join("");
  $("#thiFields").innerHTML = THI_ITEMS.map(([key, label, weight]) => `<div class="crm-thi-row"><label>${esc(label)} · k=${weight}</label><select data-field="thi_${key}" aria-label="${esc(label)}类别"><option value="">未填写</option>${[1,2,3,4,5].map((n) => `<option value="${n}">类别 ${n} · ${5-n}分</option>`).join("")}</select><input class="span-2" data-field="thiSource_${key}" aria-label="${esc(label)}来源" placeholder="来源 / 证据"></div>`).join("");
}

function collectFields() {
  const values = { ...state.values };
  ARRAY_FIELDS.forEach((field) => { values[field] = $$(`[data-field="${field}"]:checked`).map((input) => input.value); });
  BOOLEAN_FIELDS.forEach((field) => { const input = $(`[data-field="${field}"]`); if (input) values[field] = input.checked; });
  $$('[data-field]').forEach((input) => {
    const field = input.dataset.field;
    if (ARRAY_FIELDS.has(field) || BOOLEAN_FIELDS.has(field) || input.type === "radio") return;
    values[field] = input.value;
  });
  const route = $('[data-field="route"]:checked');
  if (route) values.route = route.value;
  state.values = values;
}

function restoreFields() {
  $$('[data-field]').forEach((input) => {
    const field = input.dataset.field;
    if (input.type === "radio") input.checked = state.values[field] === input.value;
    else if (input.type === "checkbox") input.checked = ARRAY_FIELDS.has(field) ? (state.values[field] || []).includes(input.value) : Boolean(state.values[field]);
    else if (state.values[field] !== undefined && state.values[field] !== null) input.value = state.values[field];
  });
}

function routePanels() {
  $$('[data-route-panel]').forEach((panel) => { panel.hidden = panel.dataset.routePanel !== state.values.route; });
  $("#routeStepDescription").textContent = state.values.route === "measured_grading" ? "使用检测浓度、国内职业接触限值、毒物危害程度和劳动强度计算 B、WB 与 G。" : "使用危害组、用量和挥发/扬尘等级确定 CA1–CA4；物理/工艺红旗独立处理。";
}

function showStep(step, { focus = true } = {}) {
  state.step = Math.min(6, Math.max(1, step));
  $$('.crm-step').forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.step) === state.step));
  $$('#stepNav li').forEach((item, index) => {
    item.classList.toggle("active", index + 1 === state.step);
    item.classList.toggle("completed", index + 1 < state.step);
  });
  $("#mobileProgressLabel").textContent = `第 ${state.step} / 6 步`;
  $("#mobileProgressBar").style.width = `${state.step / 6 * 100}%`;
  $("#backButton").disabled = state.step === 1;
  $("#nextButton").textContent = state.step === 5 ? "生成结果" : state.step === 6 ? "重新评估" : "继续";
  routePanels();
  if (state.step === 6 && state.result) renderResult(state.result);
  persist();
  if (focus) $('.crm-step.active h2')?.focus?.({ preventScroll: true });
}

function validate(step) {
  const v = state.values;
  if (step === 1 && !v.route) throw new Error("请选择一条评估路线");
  if (step === 2) {
    if (!String(v.chemicalName || "").trim()) throw new Error("请填写化学品 / 产品名称");
    if (!String(v.sdsRevision || "").trim()) throw new Error("请填写 SDS 版本 / 修订日期；不知道可填写“不清楚”");
    if (!v.physicalState) throw new Error("请选择物态");
    if (v.route === "control_banding" && !(v.ghsClassifications || []).length) throw new Error("路线 A 需要选择至少一项经 SDS 核对的 GHS 健康危害分类；未匹配时不能默认 A 组");
  }
  if (step === 3 && !String(v.taskName || "").trim()) throw new Error("请填写任务名称");
  if (step === 4 && v.route === "control_banding") {
    if (!v.amountBand || !v.exposurePotential) throw new Error("请选择用量和挥发 / 扬尘等级");
  }
  if (step === 4 && v.route === "measured_grading") {
    if (v.hasOel && !v.hazardDegree && !v.useThi) throw new Error("请选择毒物危害程度，或启用 THI 辅助计算");
    if (v.useThi) buildThiResult();
    if (v.hasOel) calculateExposureRatios(v);
  }
}

function buildThiResult() {
  const items = THI_ITEMS.map(([key, label, weight]) => {
    let category = state.values[`thi_${key}`];
    const source = String(state.values[`thiSource_${key}`] || "").trim();
    if (!category && CONSERVATIVE_KEYS.has(key)) category = 1;
    if (!category) throw new Error(`${label}缺少类别，不能完成 THI`);
    if (!source && !CONSERVATIVE_KEYS.has(key)) throw new Error(`${label}缺少数据来源`);
    return { key, label, weight, category, source: source || "缺少资料，按 GBZ/T 230—2025 注6暂按类别1" };
  });
  return calculateThi(items);
}

function buildResult() {
  const v = state.values;
  const physicalProcess = (v.physicalFlags || []).length > 0;
  const outsideScope = v.route === "control_banding" && (["gas", "aerosol", "process_generated"].includes(v.physicalState) || (v.outsideScopeFlags || []).length > 0);
  const baseFlags = collectRedFlags({
    physicalProcess, outsideScope, cmr: v.cmr, skinAbsorption: v.skinAbsorption,
    corrosive: v.corrosive, noOel: v.route === "measured_grading" && !v.hasOel,
    sampleNoncompliant: v.route === "measured_grading" && !v.sampleCompliant
  });
  const missing = [];
  if (/不清楚/.test(v.sdsRevision || "")) missing.push("SDS 版本不清楚：到 SDS 首页/第16部分核对修订日期；版本缺口影响危害分类可信度。");
  if (!(v.exposureRoutes || []).length) missing.push("接触途径未确认：结合 SDS 第8/11部分和现场任务确认吸入、皮肤与眼睛接触。");
  if (!(v.controls || []).length) missing.push("现有控制未记录：现场核对密闭、局排、维护、培训、PPE 和应急设施的真实有效性。");
  if (v.route === "control_banding") {
    const mapped = mapHazardClassifications(v.ghsClassifications || [], controlConfig.hazardClassifications);
    if (!mapped.hazardBand) throw new Error("所选分类未能映射到危害组，必须人工确认，不能默认 A 组");
    if (outsideScope) {
      return { route: "control_banding", status: "needs_specialist", headline: "需专项评估", grade: "超出路线 A 边界", mapped, flags: baseFlags, missing, action: "不要用通用 CA 矩阵给出低风险结论；请按具体危害转 GBZ/T 298、职业卫生检测或工艺安全专项评估。", path: [`危害组 ${mapped.hazardBand}`, "超出直接适用范围", "专项评估"], controls: v.controls || [] };
    }
    const level = determineControlApproach(mapped.hazardBand, v.amountBand, v.exposurePotential, controlConfig.matrix);
    const approach = controlConfig.controlApproaches[String(level)];
    if (mapped.skinBand) baseFlags.push({ key: "skinBand", label: "命中皮肤/眼睛组 S：优先防止接触，按 SDS 与渗透/突破时间选择防护材料，并设置冲洗/应急措施" });
    return { route: "control_banding", status: "screening", headline: `${approach.code} ${approach.title}`, grade: `危害组 ${mapped.hazardBand}${mapped.skinBand ? " + S" : ""}`, mapped, approach, flags: baseFlags, missing, action: approach.action, path: [`GHS 分类 → ${mapped.hazardBand}${mapped.skinBand ? "+S" : ""}`, `用量 ${v.amountBand}`, `暴露潜势 ${v.exposurePotential}`, `${approach.code}`], controls: v.controls || [] };
  }
  if (!v.hasOel) return { route: "measured_grading", status: "needs_alternative", headline: "无法按路线 B 分级", grade: "无适用 OEL", flags: baseFlags, missing, action: "转路线 A 或参照 GBZ/T 298 开展风险等级评估；不得把空白限值当作 0。", path: ["无 OEL", "停止 B/G 计算", "路线 A / GBZ/T 298"], controls: v.controls || [] };
  const thi = v.useThi ? buildThiResult() : null;
  const degree = thi ? thi.degree : v.hazardDegree;
  const wd = mapHazardDegreeToWd(degree, { highToxic: v.highToxic, acuteToxicityCat1: v.acuteToxicityCat1 });
  const candidates = calculateExposureRatios(v);
  const max = selectMaxExposureRatio(candidates);
  const wl = { "1": 1, "2": 1.5, "3": 2, "4": 2.5 }[v.laborIntensity];
  const measured = calculateMeasuredGrade({ wd, b: max.value, wl, sampleCompliant: v.sampleCompliant, flags: { cmr: v.cmr, sensitizer: v.sensitizer, skinAbsorption: v.skinAbsorption } });
  const actions = {
    "0": "保持现有作业方式和防护并定期复核；相对无害不等于无危险。",
    I: "改善环境、降低接触，落实告知、监测、健康监护、培训并核实 PPE。",
    II: "限期纠正并加强工程/工艺控制；必要时停止作业，整改后复测复评。",
    III: "立即停止相关作业，设置禁止类警示，开展专项治理和应急健康检查，整改后重新分级。"
  };
  return { route: "measured_grading", status: measured.status, headline: GRADE_LABELS[measured.adjustedGrade], grade: v.sampleCompliant ? "正式分级辅助" : "试算（采样不合规）", measured: { ...measured, candidates, max, degree, thi }, flags: baseFlags, missing, action: actions[measured.adjustedGrade], path: [`WD ${wd}`, `B ${round(max.value)} → WB ${round(measured.wb)}`, `WL ${wl}`, `G ${round(measured.g)}`, `原始 ${measured.rawGrade}级`, `最终 ${measured.adjustedGrade}级`], controls: v.controls || [] };
}

function round(value) { return Number(Number(value).toFixed(4)); }

function renderResult(result) {
  const routeLabel = result.route === "control_banding" ? "路线 A · 快速控制分级" : "路线 B · 检测数据分级";
  const gaps = result.missing.length ? result.missing.map((item) => `<div class="crm-gap">${esc(item)}</div>`).join("") : '<div class="crm-action">当前必填信息已完整；仍需由专业人员核对来源和现场有效性。</div>';
  const flags = result.flags.length ? result.flags.map((item) => `<div class="crm-flag"><strong>不可覆盖：</strong>${esc(item.label)}</div>`).join("") : '<div class="crm-action">未勾选独立红旗；这不等于确认不存在物理、工艺或健康危险。</div>';
  const controlText = result.controls.length ? result.controls.map((key) => CONTROL_LABELS[key] || key).join("、") : "尚未记录现有控制";
  const calculation = result.route === "measured_grading" && result.measured ? `<p>候选比值：${result.measured.candidates.map((item) => `${item.name}=${round(item.value)}`).join("；")}</p>${result.measured.thi ? `<p>THI=${result.measured.thi.thi}（${DEGREE_LABELS[result.measured.thi.degree]}）</p>` : `<p>危害程度：${DEGREE_LABELS[result.measured.degree]}</p>`}<p>提级原因：${result.measured.upgradeReasons.length ? esc(result.measured.upgradeReasons.join("；")) : "无"}</p>` : `<p>危害组：${esc(result.mapped?.hazardBand || "-")}；皮肤/眼睛组 S：${result.mapped?.skinBand ? "是" : "否"}</p>`;
  $("#resultRoot").className = "crm-result";
  $("#resultRoot").innerHTML = `<section class="crm-conclusion"><div><div class="eyebrow">${routeLabel} · CRM-2026.08-v1</div><h3>${esc(result.headline)}</h3><p>${esc(result.grade)} · ${new Date().toLocaleDateString("zh-CN")} · ${result.status === "trial" ? "仅供试算" : "须专业复核"}</p></div><div class="crm-grade-badge">${esc(result.headline.split(" ")[0])}</div></section>
    <section class="crm-result-card"><h3>完整计算路径</h3><div class="crm-path">${result.path.map((item, index) => `${index ? "<i>→</i>" : ""}<span>${esc(item)}</span>`).join("")}</div><div class="crm-source-list">${calculation}</div></section>
    <section class="crm-result-card"><h3>不可覆盖红旗</h3><div class="crm-flag-list">${flags}</div></section>
    <section class="crm-result-card"><h3>必须动作与控制层级</h3><div class="crm-action-list"><div class="crm-action"><strong>优先动作：</strong>${esc(result.action)}</div><div class="crm-action"><strong>现有控制：</strong>${esc(controlText)}</div><div class="crm-action"><strong>控制顺序：</strong>消除 → 替代 → 工程 → 管理 → PPE → 应急 → 监测 / 健康监护</div></div></section>
    <section class="crm-result-card"><h3>信息缺口</h3><div class="crm-gap-list">${gaps}</div></section>
    <section class="crm-result-card"><h3>复评条件</h3><p class="crm-source-list">SDS 更新；用量、温度、频次或控制措施变化；检测数据更新；事故、不适症状或 MOC 触发时，应重新评估。</p></section>
    <section class="crm-result-card"><h3>方法与来源</h3><p class="crm-source-list">路线 A：<a href="${controlConfig.source.hazardMappingUrl}" target="_blank" rel="noopener">ILO 官方危害组映射</a>与控制分级思路。路线 B：<a href="${methodsConfig.measured.sources[0].url}" target="_blank" rel="noopener">GBZ/T 229.2—2025</a>、GBZ/T 230—2025、GBZ 2.1—2019 及现行修改单。标准明确要求结合全面调查、控制效果和专业判断使用。</p></section>
    <section class="crm-result-card no-print"><h3>保存、打印与导出</h3><div class="crm-result-actions"><button class="crm-btn secondary" id="printResult">浏览器打印摘要</button><button class="crm-btn primary" id="exportResult">导出完整台账（VIP）</button><button class="crm-btn secondary" id="reassessResult">重新评估</button></div><div id="vipMessage" class="crm-vip-note crm-hidden"><strong>把单次评估变成可筛选、可跟踪、可复评的化学品风险台账。</strong><span>完整 Excel 台账为工具箱会员权益；安全结论和关键控制建议始终完整显示。</span><br><a href="../dashboard/register.html">查看外企EHS工具箱权益 →</a></div></section>`;
  $("#printResult").addEventListener("click", () => { track("chemical_matrix_export_click", { contentId: "print" }); window.print(); });
  $("#exportResult").addEventListener("click", exportExcel);
  $("#reassessResult").addEventListener("click", () => { track("chemical_matrix_reassess"); showStep(1); });
  track("chemical_matrix_complete", { contentId: result.route === "control_banding" ? `ca-${result.headline.slice(0,3).toLowerCase()}` : `grade-${result.measured?.adjustedGrade?.toLowerCase() || "na"}` });
}

async function exportExcel() {
  track("chemical_matrix_export_click", { contentId: "xlsx" });
  const allowed = await window.EhsSilVip?.hasCapability?.("chemical_risk_export");
  if (!allowed) {
    $("#vipMessage").classList.remove("crm-hidden");
    track("chemical_matrix_vip_gate_view");
    return;
  }
  if (!window.ExcelJS) return alert("Excel 组件暂时不可用，请使用浏览器打印摘要");
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = "EHS-SIL";
  const result = state.result;
  const info = workbook.addWorksheet("使用说明", { views: [{ state: "frozen", ySplit: 1 }] });
  info.addRows([["项目", "内容"], ["方法版本", "CRM-2026.08-v1"], ["导出时间", new Date()], ["使用边界", "用于筛查和分级辅助，不构成合规或安全结论。"], ["路线", result.route]]);
  const summary = workbook.addWorksheet("评估汇总", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.addRows([["工厂", "部门", "岗位", "任务", "化学品", "路线", "最终结果", "动作优先级"], [state.values.site || "", state.values.department || "", state.values.position || "", state.values.taskName || "", state.values.chemicalName || "", result.route, result.headline, result.action]]);
  const detail = workbook.addWorksheet("计算明细", { views: [{ state: "frozen", ySplit: 1 }] });
  detail.addRows([["字段", "数值"], ...result.path.map((value, index) => [`计算步骤 ${index + 1}`, value]), ["方法版本", "CRM-2026.08-v1"]]);
  const flags = workbook.addWorksheet("红旗与缺口", { views: [{ state: "frozen", ySplit: 1 }] });
  flags.addRows([["类型", "内容"], ...result.flags.map((item) => ["红旗", item.label]), ...result.missing.map((item) => ["信息缺口", item])]);
  const actions = workbook.addWorksheet("整改跟踪", { views: [{ state: "frozen", ySplit: 1 }] });
  actions.addRows([["问题", "控制层级", "措施", "责任人", "期限", "状态", "完成证据", "复评结果"], [result.headline, "待确认", result.action, "", "", "未开始", "", ""]]);
  workbook.eachSheet((sheet) => { sheet.autoFilter = { from: "A1", to: sheet.getRow(1).lastCell.address }; sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123B4A" } }; sheet.columns.forEach((column) => { column.width = 20; }); });
  const buffer = await workbook.xlsx.writeBuffer();
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([buffer])); link.download = `EHS-SIL-化学品作业风险台账-${new Date().toISOString().slice(0,10)}.xlsx`; link.click(); URL.revokeObjectURL(link.href);
}

function loadDemo() {
  state.values = { ...state.values, route: "measured_grading", chemicalName: "演示清洗剂", cas: "", sdsRevision: "2026-05-20（演示）", physicalState: "liquid", mixture: "true", ghsClassifications: ["skin_irritation_2", "eye_irritation_2"], taskName: "人工擦拭清洗", operationType: "清洗", locationType: "indoor", enclosure: "open", processTemperature: "25", frequencyPerShift: "4", durationMinutes: "15", exposureRoutes: ["inhalation", "skin", "eyes"], hazardDegree: "moderate", laborIntensity: "1", twa: "25", pcTwa: "50", stel: "90", pcStel: "100", peak: "", macMeasured: "", macLimit: "", unit: "mg/m³", limitUnit: "mg/m³", sampleCompliant: true, hasOel: true, corrosive: true, controls: ["ventilation", "training", "ppe", "emergency"], physicalFlags: [] };
  restoreFields(); routePanels(); showStep(2); track("chemical_matrix_demo_load", { contentId: "measured-demo" });
}

async function init() {
  try {
    [controlConfig, methodsConfig] = await Promise.all([fetch("../data/control-banding-v1.json").then((r) => { if (!r.ok) throw new Error(); return r.json(); }), fetch("../data/chemical-risk-methods-v1.json").then((r) => { if (!r.ok) throw new Error(); return r.json(); })]);
  } catch (_) {
    $("#stepError").textContent = "方法配置加载失败。为避免错误分级，工具已停止计算，请刷新后重试。";
    $("#nextButton").disabled = true;
    return;
  }
  renderDynamicFields(); hydrate(); restoreFields(); routePanels(); showStep(state.step, { focus: false });
  if (state.result && state.step === 6) renderResult(state.result);
  track("chemical_matrix_view");
  $("#startButton").addEventListener("click", () => { document.querySelector("#assessment").scrollIntoView({ behavior: "smooth" }); track("chemical_matrix_start"); });
  $("#demoButton").addEventListener("click", loadDemo);
  $("#backButton").addEventListener("click", () => { collectFields(); showStep(state.step - 1); });
  $("#nextButton").addEventListener("click", () => {
    $("#stepError").textContent = "";
    try {
      collectFields();
      if (state.step === 6) { showStep(1); track("chemical_matrix_reassess"); return; }
      validate(state.step);
      if (state.step === 1) track("chemical_matrix_route_select", { contentId: state.values.route === "control_banding" ? "route-a" : "route-b" });
      if (state.step === 5) { state.result = buildResult(); showStep(6); renderResult(state.result); }
      else showStep(state.step + 1);
    } catch (error) { $("#stepError").textContent = error.message; }
  });
  $("#clearButton").addEventListener("click", () => {
    if (!confirm("仅清除本工具在当前浏览器保存的草稿和结果，确定继续？")) return;
    localStorage.removeItem(STORAGE_KEY); state = { step: 1, values: { hasOel: true, unit: "mg/m³", limitUnit: "mg/m³", laborIntensity: "1", mixture: "false" }, result: null }; restoreFields(); showStep(1); $("#saveStatus").textContent = "已清除";
  });
  $("#wizard").addEventListener("change", () => { collectFields(); routePanels(); persist(); try { if (state.values.useThi) { const thi = buildThiResult(); $("#thiPreview").textContent = `THI ${thi.thi} · ${DEGREE_LABELS[thi.degree]}`; } } catch (_) { $("#thiPreview").textContent = "继续填写 THI 类别与来源"; } });
  $$('#stepNav [data-step-target]').forEach((button) => button.addEventListener("click", () => { const target = Number(button.dataset.stepTarget); if (target <= state.step) { collectFields(); showStep(target); } }));
}

init();

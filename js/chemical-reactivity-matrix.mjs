import {
  STATUS_META, CRW_REFERENCE_SCENARIO, validateProductionData, searchIdentityCandidates, predictChemicalPair,
  buildCompatibilityMatrix, summarizeMatrix, deriveStorageActions, createUserDraftRecord, createReactiveGroupProxy,
  createQuickWaterRecord, createCustomScenario, createProject, duplicateProject, archiveProject, updateProject,
  createPairOverride, reviewPairOverride, applyPairOverride, invalidateStaleOverrides
} from "./chemical-reactivity-engine.mjs";
import { buildReactivityWorkbook, exportFilename } from "./chemical-reactivity-export.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const state = { config: null, manifest: null, chemicals: [], groupPairs: [], directEvidence: [], consequences: [], mixingScenarios: [], localRecords: [], importedPending: [], projects: [], activeProjectId: "", overrides: [], matrix: [], summary: null, storageError: null, matrixLimit: 10, matrixView: "lower", currentResult: null };

function countBucket(count) { return count <= 10 ? "1-10" : count <= 50 ? "11-50" : "51+"; }
function track(event, { status = "", count = 0, exportType = "" } = {}) {
  window.EhsSilAnalytics?.track?.(event, { toolId: "chemical-reactivity-matrix", pageType: "other", sourceChannel: "site", resultBucket: count ? countBucket(count) : "", exportType, contentId: status ? `status_${String(status).toLowerCase()}` : "" });
}
function allRecords() { return [...state.chemicals, ...state.localRecords].filter((record) => !record.archivedAt); }
function confirmedRecords() { return allRecords().filter((record) => record.identityConfirmed); }
function activeProject() { return state.projects.find((item) => item.id === state.activeProjectId && !item.archivedAt) || state.projects.find((item) => !item.archivedAt); }
function currentScenario() { return activeProject()?.scenario || state.mixingScenarios[0] || CRW_REFERENCE_SCENARIO; }
function projectRecords() {
  const project = activeProject();
  const records = confirmedRecords();
  if (!project) return records.slice(0, state.matrixLimit);
  return project.componentIds.map((id) => records.find((item) => item.id === id)).filter(Boolean).slice(0, state.matrixLimit);
}
function dataContext() { return { groupPairs: state.groupPairs, directEvidence: state.directEvidence, sourceManifest: state.manifest, scenario: currentScenario() }; }

function ensureProject() {
  if (!state.projects.some((item) => !item.archivedAt)) {
    const project = createProject({ name: "临时混合体系", componentIds: confirmedRecords().map((item) => item.id), scenario: state.mixingScenarios[0] || CRW_REFERENCE_SCENARIO });
    state.projects.push(project); state.activeProjectId = project.id;
  }
  if (!state.activeProjectId || !activeProject()) state.activeProjectId = state.projects.find((item) => !item.archivedAt)?.id || "";
}
function loadLocalState() {
  const keys = [state.config.storageKey, state.config.legacyStorageKey].filter(Boolean);
  const raw = keys.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) { ensureProject(); return; }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.records)) throw new Error("records 不是数组");
    state.localRecords = parsed.records; state.importedPending = Array.isArray(parsed.importedPending) ? parsed.importedPending : [];
    state.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    state.overrides = Array.isArray(parsed.overrides) ? parsed.overrides : [];
    state.activeProjectId = parsed.activeProjectId || "";
    state.overrides = invalidateStaleOverrides(state.overrides, { ruleVersion: state.config.ruleVersion, dataVersion: state.manifest.dataVersion });
    ensureProject();
  } catch (error) { state.storageError = { raw, message: error.message }; ensureProject(); }
}
function saveLocalState() {
  localStorage.setItem(state.config.storageKey, JSON.stringify({ version: "2.1", records: state.localRecords, importedPending: state.importedPending, projects: state.projects, activeProjectId: state.activeProjectId, overrides: state.overrides, savedAt: new Date().toISOString() }));
}

function setTab(name) {
  $$('[data-tab]').forEach((button) => { const active = button.dataset.tab === name; button.setAttribute("aria-selected", String(active)); document.getElementById(`${button.dataset.tab}Panel`).hidden = !active; });
  if (name === "pair") renderPairSelectors();
  if (name === "matrix") renderMatrix();
  if (name === "projects") renderProjects();
}
function renderVersion() {
  $("#versionCard span").textContent = `${state.config.referenceToolVersion} · ${state.manifest.dataVersion} · 已批准生产记录 ${state.manifest.approvedProductionRecordCount}`;
  if (state.storageError) {
    $("#dataGate").insertAdjacentHTML("afterbegin", `<div><strong>本地存储损坏，已停止读取</strong><p>${escapeHtml(state.storageError.message)}。请先下载原始数据或清除后重建清单。</p><button class="crx-btn secondary" id="downloadRawButton" type="button">下载原始数据</button></div>`);
    $("#downloadRawButton").addEventListener("click", () => downloadBlob("chemical-reactivity-corrupt-local-data.txt", state.storageError.raw, "text/plain"));
  }
}
function renderScenario() {
  const scenario = currentScenario();
  $("#scenarioTitle").textContent = scenario.name;
  $("#scenarioSummary").textContent = `${scenario.mode === "CRW_REFERENCE" ? "CRW 参考" : "用户自定义"} · 最高 ${Number.isFinite(scenario.temperatureMaxC) ? `${scenario.temperatureMaxC}°C` : "温度未知"} · ${scenario.insulatedVessel ? "绝热" : "非绝热/未知"}、${scenario.airtightVessel ? "气密/可能升压" : "非气密"} · ${Number.isFinite(scenario.durationHours) ? `${scenario.durationHours} 小时` : "时间未知"} · ${scenario.additionOrderNote || "未模拟具体加料顺序"}`;
}

function renderCandidateList(records) {
  const root = $("#searchResults"), input = $("#chemicalSearch");
  if (!records.length) {
    root.innerHTML = `<div class="crx-empty"><strong>未找到，不代表无禁忌</strong><p>请核对 CAS、浓度、物态和最新版 SDS，或使用 CAMEO/CRW 官方入口。</p></div>`;
    root.hidden = false; input.setAttribute("aria-expanded", "true"); track("reactivity_unknown_result", { status: "not_found" }); return;
  }
  root.innerHTML = records.map((record, index) => `<button type="button" class="crx-candidate" role="option" data-record-id="${escapeHtml(record.id)}" tabindex="${index ? -1 : 0}"><strong>${escapeHtml(record.preferredName)}</strong><span>${escapeHtml([record.casNumber, ...(record.unNumbers || []), record.substanceForm, record.concentrationNote, record.recordKind, record.sourceRefs?.[0]?.version].filter(Boolean).join(" · "))}</span></button>`).join("");
  root.hidden = false; input.setAttribute("aria-expanded", "true"); $$(".crx-candidate").forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.recordId)));
}
function runSearch() {
  const query = $("#chemicalSearch").value.trim(), mode = $('input[name="searchMode"]:checked')?.value || "exact"; track("reactivity_search_started");
  if (!query) return renderCandidateList([]);
  try { renderCandidateList(searchIdentityCandidates({ name: query, mode }, allRecords())); } catch (error) { renderCandidateList([]); $("#searchResults").insertAdjacentHTML("afterbegin", `<p class="crx-error">${escapeHtml(error.message)}</p>`); }
}
function selectRecord(id) {
  const record = allRecords().find((item) => item.id === id); if (!record) return;
  $("#searchResults").hidden = true; $("#chemicalSearch").setAttribute("aria-expanded", "false"); $("#chemicalSearch").value = record.preferredName; renderSingleResult(record); track("reactivity_identity_confirmed", { status: record.identityConfirmed ? "confirmed" : "needs_confirmation" });
}
function listHtml(items, emptyText) { return items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.summary || item.title || "")}</li>`).join("")}</ul>` : `<p>${escapeHtml(emptyText)}</p>`; }
function renderSingleResult(record) {
  const source = record.sourceRefs?.[0] || {}, intrinsic = STATUS_META[record.selfReactivityStatus || "UNKNOWN"];
  $("#singleResult").className = "";
  $("#singleResult").innerHTML = `<article class="crx-identity-card"><div><h3>${escapeHtml(record.preferredName)}</h3><div class="crx-meta"><span>${escapeHtml(record.casNumber || "CAS 未提供")}</span><span>${escapeHtml((record.unNumbers || []).join("、") || "UN/NA 未提供")}</span><span>${escapeHtml(record.substanceForm || "物态未提供")}</span><span>${escapeHtml(record.concentrationNote || "浓度/配方未提供")}</span><span>${escapeHtml(record.recordKind || "CHEMICAL")}</span></div><p class="crx-disclaimer">来源：${escapeHtml(source.sourceId || "未知")} · ${escapeHtml(source.version || "无版本")} · 记录 ${escapeHtml(source.recordId || record.id)}</p></div><span class="crx-layer">${escapeHtml(record.evidenceLayer || "官方/外部数据库")}</span></article>
    ${record.identityConfirmed ? "" : `<div class="crx-status-card" data-status="UNKNOWN"><strong>身份未确认：阻断两两计算与正式矩阵</strong><p>请核对具体记录、浓度/物态与最新版 SDS 后重新录入确认。</p></div>`}
    <div class="crx-card-grid"><article class="crx-evidence-card"><h3>固有反应性 ${intrinsic.icon} ${escapeHtml(intrinsic.label)}</h3>${listHtml(record.reactivityAlerts, "当前记录没有已录入警示；不代表没有反应性危险。")}</article><article class="crx-evidence-card"><h3>具体禁忌物</h3>${listHtml(record.directIncompatibilities, "当前记录没有已录入禁忌物；请核对 SDS 第 10 节和官方工具。")}</article><article class="crx-evidence-card"><h3>禁忌反应类别 / 反应组</h3>${listHtml(record.reactiveGroupIds, "反应组资料不足，任何组对计算将保持 UNKNOWN。")}</article><article class="crx-evidence-card"><h3>储存与现场核实</h3><ul><li>核对空气、水、热、冲击、摩擦、自聚合和自分解信息</li><li>核对吸附剂、设备材料、消防介质和共用排液</li><li>按最新版 SDS 和企业制度由合格人员确定</li></ul></article></div>
    <div class="crx-report-actions"><button class="crx-btn secondary" type="button" data-add-pair="${escapeHtml(record.id)}">加入配伍检查</button><button class="crx-btn primary" type="button" data-add-project="${escapeHtml(record.id)}">加入当前项目</button></div>`;
  $('[data-add-pair]')?.addEventListener("click", () => { setTab("pair"); $("#pairA").value = record.id; });
  $('[data-add-project]')?.addEventListener("click", () => { addRecordToProject(record.id); setTab("matrix"); });
}

function renderPairSelectors() {
  const records = confirmedRecords(), options = [`<option value="">请选择已确认记录</option>`, ...records.map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.preferredName)}</option>`)].join("");
  [$("#pairA"), $("#pairB")].forEach((select) => { const current = select.value; select.innerHTML = options; if (records.some((record) => record.id === current)) select.value = current; });
  if (records.length > 1 && !$("#pairB").value) $("#pairB").value = records[1].id; $("#inventoryCount").textContent = String(projectRecords().length);
}
function consequenceLabel(id) { return state.consequences.find((item) => item.id === id)?.labelZh || id; }
function resultMarkup(result) {
  if (result.cellKind === "INTRINSIC") return `<article class="crx-status-card" data-status="${result.status}"><div class="crx-status-title"><div><p>${escapeHtml(result.chemicalA.name)}</p><h3>${result.statusMeta.icon} ${escapeHtml(result.statusMeta.label)}</h3></div><span class="crx-status-badge">${result.sourceCode}</span></div>${listHtml(result.evidence, "没有已批准固有反应性资料；对角线保持 ?。") }<div class="crx-disclaimer">${escapeHtml(result.disclaimer)}</div></article>`;
  result.storageActions = deriveStorageActions(result);
  const sources = result.sourceRefs.length ? result.sourceRefs.map((source) => `${source.sourceId}/${source.recordId || "-"}/${source.version}`) : ["当前没有可追溯的组对来源"];
  const evidence = result.evidence.length ? result.evidence.map((item) => `${item.evidenceType === "DIRECT" ? "直接资料" : `反应组 ${item.key}`}：${item.summary}`) : ["没有已批准的直接证据或组对规则"];
  const override = result.override ? `<div class="crx-override-card"><strong>* 人工修订（${escapeHtml(result.override.status)}）</strong><p>原预测：${escapeHtml(result.predictedStatus)}；修订后：${escapeHtml(result.override.revisedStatus)}</p><p>${escapeHtml(result.override.reason)}</p><small>${escapeHtml(result.override.createdBy)} · ${escapeHtml(result.override.createdAt)}${result.override.reviewedBy ? `；复核：${escapeHtml(result.override.reviewedBy)}` : "；待第二人复核"}</small></div>` : "";
  return `<article class="crx-status-card" data-status="${result.status}"><div class="crx-status-title"><div><p>${escapeHtml(result.chemicalA.name)} ＋ ${escapeHtml(result.chemicalB.name)}</p><h3>${result.statusMeta.icon} ${escapeHtml(result.statusMeta.label)}</h3></div><span class="crx-status-badge">${escapeHtml(result.sourceCode)}${result.overrideMarker || ""} · ${escapeHtml(result.status)}</span></div>
    <div class="crx-scenario-inline"><strong>当前情景：</strong>${escapeHtml(result.scenario.name)} · ${escapeHtml(result.scenario.mode)}${result.scenarioWarnings.length ? `<p>外推警告：${escapeHtml(result.scenarioWarnings.join("；"))}</p>` : ""}</div>
    <div class="crx-detail-tabs" role="tablist"><button type="button" data-detail-tab="hazard" aria-selected="true">危害摘要</button><button type="button" data-detail-tab="gases" aria-selected="false">潜在气体</button><button type="button" data-detail-tab="docs" aria-selected="false">依据</button><button type="button" data-detail-tab="comments" aria-selected="false">成对备注</button></div>
    <div data-detail-panel="hazard"><div class="crx-result-grid"><div><strong>主要后果</strong>${listHtml(result.consequenceTags.map(consequenceLabel), "没有获准数据支持具体后果；不得据此判为安全。")}</div><div><strong>未知项与缺口</strong>${listHtml([...result.missingGroupPairs, ...result.uncertaintyFlags], "当前组对数据完整。")}</div><div><strong>下一步</strong>${listHtml(result.storageActions, "由合格人员复核")}</div><div><strong>升级评估</strong>${listHtml(result.escalationReasons, "当前未触发自动升级信号，但仍需人工复核。")}</div></div></div>
    <div data-detail-panel="gases" hidden>${listHtml(result.possibleGases, "无已批准气体数据；系统不会猜测。")}</div>
    <div data-detail-panel="docs" hidden><div class="crx-result-grid"><div><strong>全部证据与组对</strong>${listHtml(evidence, "无")}</div><div><strong>来源与版本</strong>${listHtml(sources, "无")}</div></div></div>
    <div data-detail-panel="comments" hidden>${override || "<p>暂无成对备注或人工修订。</p>"}<button class="crx-btn secondary" type="button" data-open-override="${escapeHtml(result.pairKey)}">提出人工修订</button></div>
    ${result.escalateProcessSafety ? `<div class="crx-disclaimer"><strong>升级工艺安全评估：</strong>建议 PHA/HAZOP/What-if、反应量热或热分析、MOC 以及联锁/泄压复核。</div>` : ""}<div class="crx-disclaimer">${escapeHtml(result.disclaimer)}</div></article>`;
}
function bindDetailTabs(root) {
  root.querySelectorAll("[data-detail-tab]").forEach((button) => button.addEventListener("click", () => {
    root.querySelectorAll("[data-detail-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    root.querySelectorAll("[data-detail-panel]").forEach((panel) => { panel.hidden = panel.dataset.detailPanel !== button.dataset.detailTab; });
  }));
  root.querySelector("[data-open-override]")?.addEventListener("click", () => openOverrideDialog(state.currentResult));
}
function applyStoredOverride(result) { return applyPairOverride(result, state.overrides.find((item) => item.pairKey === result.pairKey && item.scenarioId === result.scenario.id && ["DRAFT", "APPROVED"].includes(item.status))); }
function checkPair() {
  const a = confirmedRecords().find((record) => record.id === $("#pairA").value), b = confirmedRecords().find((record) => record.id === $("#pairB").value);
  if (!a || !b || a.id === b.id) { $("#pairResult").className = "crx-empty"; $("#pairResult").innerHTML = "<strong>请选择两个不同且已确认身份的记录</strong><p>模糊身份不会进入相容性计算。</p>"; return; }
  state.currentResult = applyStoredOverride(predictChemicalPair(a, b, dataContext())); $("#pairResult").className = ""; $("#pairResult").innerHTML = resultMarkup(state.currentResult); bindDetailTabs($("#pairResult")); track("reactivity_pair_checked", { status: state.currentResult.status }); if (state.currentResult.status === "UNKNOWN") track("reactivity_unknown_result", { status: state.currentResult.status });
}

function cellMarkup(cell, i, j, rowName, columnName) {
  if (state.matrixView === "lower" && j > i) return `<td class="crx-hidden-cell" aria-hidden="true"></td>`;
  return `<td><button class="crx-cell ${cell.status}" type="button" data-cell="${i}:${j}" aria-label="${escapeHtml(rowName)} 与 ${escapeHtml(columnName)}：${escapeHtml(cell.statusMeta.label)}"><b>${escapeHtml(cell.sourceCode || "?")}${cell.overrideMarker || ""}</b><span>${escapeHtml(cell.statusMeta.label)}</span></button></td>`;
}
function renderMatrix() {
  const all = confirmedRecords(), records = projectRecords(); $("#inventoryCount").textContent = String(records.length);
  if (!records.length) { $("#matrixTableRoot").innerHTML = `<div class="crx-empty"><strong>当前项目没有已确认组分</strong><p>先录入并确认身份，再从“我的项目”加入组分。</p></div>`; $("#matrixSummary").innerHTML = ""; $("#anomalyList").innerHTML = ""; return; }
  state.matrix = buildCompatibilityMatrix(records, dataContext()).map((row) => row.map((cell) => cell.cellKind === "PAIR" ? applyStoredOverride(cell) : cell));
  state.summary = summarizeMatrix(state.matrix); state.summary.pairs.forEach((pair) => { pair.storageActions = deriveStorageActions(pair); });
  const labels = { INCOMPATIBLE: "不相容", CAUTION: "谨慎", UNKNOWN: "未知", CONFLICT_REVIEW: "冲突", NO_PREDICTED_HAZARD: "未预测", SELF_REACTIVE: "SR 自反应", NO_SELF_REACTION_IDENTIFIED: "X 无自反应识别" };
  $("#matrixSummary").innerHTML = `${all.length > records.length ? `<span>已确认 ${all.length} 条；当前项目/上限使用 ${records.length} 条</span>` : ""}${["INCOMPATIBLE", "CAUTION", "UNKNOWN", "CONFLICT_REVIEW", "NO_PREDICTED_HAZARD"].map((status) => `<span>${labels[status]} ${state.summary.counts[status] || 0}</span>`).join("")}<span>${labels.SELF_REACTIVE} ${state.summary.intrinsicCounts.SELF_REACTIVE || 0}</span>`;
  const head = records.map((record) => `<th scope="col" title="${escapeHtml(record.preferredName)}">${escapeHtml(record.preferredName)}</th>`).join("");
  const rows = records.map((record, i) => `<tr><th scope="row" title="${escapeHtml(record.preferredName)}">${escapeHtml(record.preferredName)}</th>${state.matrix[i].map((cell, j) => cellMarkup(cell, i, j, record.preferredName, records[j].preferredName)).join("")}</tr>`).join("");
  $("#matrixTableRoot").hidden = state.matrixView === "anomalies"; $("#matrixTableRoot").innerHTML = `<table class="crx-matrix"><thead><tr><th scope="col">化学品</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  const anomalies = state.summary.pairs.filter((pair) => pair.status !== "NO_PREDICTED_HAZARD");
  $("#anomalyList").hidden = state.matrixView !== "anomalies" && matchMedia("(min-width:721px)").matches;
  $("#anomalyList").innerHTML = `<h3>异常组合列表</h3>${anomalies.length ? anomalies.map((pair) => `<button class="crx-anomaly" type="button" data-pair-key="${escapeHtml(pair.pairKey)}"><span>${escapeHtml(pair.chemicalA.name)} ＋ ${escapeHtml(pair.chemicalB.name)}</span><strong>${escapeHtml(pair.sourceCode)}${pair.overrideMarker || ""} · ${escapeHtml(pair.statusMeta.label)}</strong></button>`).join("") : "<p>当前没有异常组合；这不等于安全批准。</p>"}`;
  $$('[data-cell]').forEach((button) => button.addEventListener("click", () => { const [i, j] = button.dataset.cell.split(":").map(Number); openDrawer(state.matrix[i][j]); }));
  $$('[data-pair-key]').forEach((button) => button.addEventListener("click", () => openDrawer(state.summary.pairs.find((pair) => pair.pairKey === button.dataset.pairKey))));
  track("reactivity_matrix_generated", { count: records.length });
}
function openDrawer(result) { if (!result) return; state.currentResult = result; $("#drawerTitle").textContent = result.cellKind === "INTRINSIC" ? `${result.chemicalA.name}｜固有反应性` : `${result.chemicalA.name} ＋ ${result.chemicalB.name}`; $("#drawerBody").innerHTML = resultMarkup(result); bindDetailTabs($("#drawerBody")); $("#detailDrawer").classList.add("open"); $("#detailDrawer").setAttribute("aria-hidden", "false"); $("#drawerBackdrop").hidden = false; $("#closeDrawer").focus(); }
function closeDrawer() { $("#detailDrawer").classList.remove("open"); $("#detailDrawer").setAttribute("aria-hidden", "true"); $("#drawerBackdrop").hidden = true; }

function addRecordToProject(id) { ensureProject(); const project = activeProject(); if (!project.componentIds.includes(id)) state.projects[state.projects.indexOf(project)] = updateProject(project, { componentIds: [...project.componentIds, id] }); saveLocalState(); renderProjects(); }
function saveRecord(event) {
  event.preventDefault(); const form = $("#recordForm"), values = Object.fromEntries(new FormData(form)); values.mixtureFlag = values.mixtureFlag === "true"; values.identityConfirmed = values.identityConfirmed === "on";
  try { const record = createUserDraftRecord(values); state.localRecords.push(record); addRecordToProject(record.id); saveLocalState(); form.reset(); $("#recordDialog").close(); renderPairSelectors(); $("#chemicalSearch").value = record.preferredName; renderSingleResult(record); } catch (error) { $("#recordError").textContent = error.message; }
}
function quickAddWater() { const approved = state.chemicals.find((item) => item.quickAddKey === "WATER" && item.reviewStatus === "APPROVED"); const record = createQuickWaterRecord(approved); if (!approved) state.localRecords.push(record); addRecordToProject(record.id); saveLocalState(); renderPairSelectors(); $("#chemicalSearch").value = record.preferredName; renderSingleResult(record); }
function saveGroupProxy(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
  try { const record = createReactiveGroupProxy(values); state.localRecords.push(record); addRecordToProject(record.id); saveLocalState(); event.currentTarget.reset(); $("#groupProxyDialog").close(); renderPairSelectors(); renderSingleResult(record); } catch (error) { $("#groupProxyError").textContent = error.message; }
}
function saveScenario(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const scenario = values.mode === "CRW_REFERENCE" ? structuredClone(state.mixingScenarios[0] || CRW_REFERENCE_SCENARIO) : createCustomScenario({ ...values, insulatedVessel: values.insulatedVessel === "true", airtightVessel: values.airtightVessel === "true" });
    const project = activeProject(); state.projects[state.projects.indexOf(project)] = updateProject(project, { scenario }); saveLocalState(); $("#scenarioDialog").close(); renderScenario(); renderMatrix();
  } catch (error) { $("#scenarioError").textContent = error.message; }
}
function openOverrideDialog(result) { if (!result || result.cellKind !== "PAIR") return; const form = $("#overrideForm"); form.reset(); form.elements.pairKey.value = result.pairKey; form.elements.predictedStatus.value = result.predictedStatus; $("#overrideDialog").showModal(); }
function saveOverride(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)), today = new Date().toISOString().slice(0, 10);
  try {
    if (values.reviewedBy && values.reviewedBy.trim() === values.createdBy.trim()) throw new Error("人工修订必须由第二人复核");
    const input = { pairKey: values.pairKey, predictedStatus: values.predictedStatus, revisedStatus: values.revisedStatus, reason: values.reason, scenarioId: currentScenario().id, ruleVersion: state.config.ruleVersion, dataVersion: state.manifest.dataVersion, createdBy: values.createdBy, reviewedBy: values.revisedStatus === "NO_PREDICTED_HAZARD" ? values.reviewedBy : undefined, evidenceRefs: [{ sourceId: "USER_OVERRIDE_EVIDENCE", title: values.evidenceTitle, version: values.evidenceVersion, reviewedAt: today, licenseClass: "USER_PROVIDED_LOCAL_ONLY" }] };
    let override = createPairOverride(input);
    if (values.reviewedBy && override.status !== "APPROVED") override = reviewPairOverride(override, values.reviewedBy);
    state.overrides = state.overrides.filter((item) => !(item.pairKey === override.pairKey && item.scenarioId === override.scenarioId && ["DRAFT", "APPROVED"].includes(item.status))); state.overrides.push(override); saveLocalState(); $("#overrideDialog").close(); closeDrawer(); renderMatrix(); checkPair();
  } catch (error) { $("#overrideError").textContent = error.message; }
}

function renderProjects() {
  ensureProject(); const project = activeProject(), records = confirmedRecords(); $("#projectCount").textContent = String(state.projects.filter((item) => !item.archivedAt).length);
  $("#projectWorkspace").innerHTML = `<article class="crx-project-card"><div class="crx-project-meta"><label>项目名称<input id="projectNameInput" value="${escapeHtml(project.name)}"></label><label>场所 / 装置<input id="projectSiteInput" value="${escapeHtml(project.site)}"></label><label>创建人<input id="projectCreatorInput" value="${escapeHtml(project.createdBy)}"></label><label>复核人<input id="projectReviewerInput" value="${escapeHtml(project.reviewedBy)}"></label></div><div class="crx-meta"><span>项目版本 ${project.version}</span><span>创建 ${escapeHtml(project.createdAt)}</span><span>更新 ${escapeHtml(project.updatedAt)}</span><span>数据 ${escapeHtml(state.manifest.dataVersion)}</span><span>状态 ${escapeHtml(project.status)}</span></div><label class="crx-project-notes">项目备注（不作为权威证据）<textarea id="projectNotesInput" rows="3">${escapeHtml(project.notes)}</textarea></label><button class="crx-btn primary" id="saveProjectButton" type="button">保存项目元数据</button></article>
    <article class="crx-project-components"><h3>项目组分 ${project.componentIds.length} / ${state.matrixLimit}</h3><p>反应组代理会明确标记为组级推断；未确认身份的记录不能加入正式矩阵。</p>${records.length ? records.map((record) => `<label><input type="checkbox" data-project-record="${escapeHtml(record.id)}" ${project.componentIds.includes(record.id) ? "checked" : ""}> <span>${escapeHtml(record.preferredName)}</span><small>${escapeHtml(record.recordKind || "CHEMICAL")} · ${escapeHtml(record.reviewStatus || "")}</small></label>`).join("") : "<div class=\"crx-empty\">尚无已确认记录</div>"}</article>`;
  $("#saveProjectButton").addEventListener("click", () => { const updated = updateProject(project, { name: $("#projectNameInput").value.trim(), site: $("#projectSiteInput").value.trim(), createdBy: $("#projectCreatorInput").value.trim(), reviewedBy: $("#projectReviewerInput").value.trim(), notes: $("#projectNotesInput").value.trim() }); state.projects[state.projects.indexOf(project)] = updated; saveLocalState(); renderProjects(); renderScenario(); });
  $$('[data-project-record]').forEach((input) => input.addEventListener("change", () => { const ids = $$('[data-project-record]:checked').map((item) => item.dataset.projectRecord); if (ids.length > state.matrixLimit) { input.checked = false; alert(`当前账户项目上限为 ${state.matrixLimit} 种。`); return; } state.projects[state.projects.indexOf(project)] = updateProject(project, { componentIds: ids }); saveLocalState(); renderMatrix(); }));
}
async function createNewProject(copy = false) {
  const activeCount = state.projects.filter((item) => !item.archivedAt).length, member = await window.EhsSilVip?.hasCapability?.("chemical_reactivity_projects");
  if (activeCount >= 1 && !member) { track("reactivity_upgrade_clicked", { count: activeCount }); $("#projectWorkspace").insertAdjacentHTML("afterbegin", `<div class="crx-import-report">免费用户可使用一个临时项目；多个保存项目与版本管理为会员效率功能，安全结论不受限制。</div>`); return; }
  const project = copy ? duplicateProject(activeProject()) : createProject({ name: prompt("项目名称", "新建混合体系") || "新建混合体系", componentIds: [], scenario: state.mixingScenarios[0] || CRW_REFERENCE_SCENARIO });
  state.projects.push(project); state.activeProjectId = project.id; saveLocalState(); renderProjects(); renderScenario(); renderMatrix();
}
function archiveCurrentProject() { const project = activeProject(); if (!project || !confirm(`归档“${project.name}”？历史报告仍可追溯。`)) return; state.projects[state.projects.indexOf(project)] = archiveProject(project); state.activeProjectId = ""; ensureProject(); saveLocalState(); renderProjects(); renderScenario(); renderMatrix(); }
function deleteCurrentProject() { const project = activeProject(); if (!project || !confirm(`永久删除当前浏览器中的“${project.name}”及其项目备注？化学品本地记录和其他项目不会删除。`)) return; state.projects = state.projects.filter((item) => item.id !== project.id); state.activeProjectId = ""; ensureProject(); saveLocalState(); renderProjects(); renderScenario(); renderMatrix(); }
function renderMixtureReport() {
  renderMatrix(); const project = activeProject(), root = $("#mixtureReport"); root.hidden = false;
  root.innerHTML = `<h3>混合物报告｜${escapeHtml(project.name)}</h3><p><strong>当前情景：</strong>${escapeHtml(currentScenario().name)}；最高 ${escapeHtml(currentScenario().temperatureMaxC)}°C；${escapeHtml(currentScenario().durationHours)} 小时。</p><h4>固有反应性</h4>${listHtml(state.summary?.intrinsic.map((item) => `${item.sourceCode} ${item.chemicalA.name}：${item.statusMeta.label}`), "无组分")}<h4>异常组对</h4>${listHtml(state.summary?.pairs.filter((item) => item.status !== "NO_PREDICTED_HAZARD").map((item) => `${item.sourceCode}${item.overrideMarker || ""} ${item.chemicalA.name} + ${item.chemicalB.name}：${item.statusMeta.label}`), "无异常记录；不等于安全批准")}<h4>潜在气体</h4>${listHtml([...new Set(state.summary?.pairs.flatMap((item) => item.possibleGases || []))], "无已批准气体数据；系统不会猜测") }<h4>待复核</h4>${listHtml(state.overrides.filter((item) => item.status === "DRAFT").map((item) => `${item.pairKey}：人工修订待第二人复核`), "无待复核人工修订")}<div class="crx-disclaimer">本报告只展开两两组合，不预测三元及以上协同反应、催化效应或实际投料顺序造成的危险。</div>`;
}

function parseCsv(text) { const rows = []; let row = [], field = "", quoted = false; for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(field); field = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = ""; } else field += char; } row.push(field); if (row.some((value) => value.trim())) rows.push(row); return rows; }
function rowsToObjects(rows) { const headers = (rows.shift() || []).map((value) => String(value || "").trim()); return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]))).filter((item) => item.input_name); }
async function handleImport(event) {
  const file = event.target.files?.[0]; if (!file) return; let rows;
  if (/\.xlsx$/i.test(file.name)) { const workbook = new window.ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer()); rows = []; workbook.worksheets[0].eachRow((row) => rows.push(row.values.slice(1).map((value) => value?.text || value || ""))); } else rows = parseCsv(await file.text());
  const items = rowsToObjects(rows), report = { confirmed: 0, multiple: 0, notFound: 0, insufficient: 0 }, confirmedIds = [];
  state.importedPending = items.map((item) => { let candidates = []; try { candidates = searchIdentityCandidates({ name: item.input_name, cas: item.cas_number, un: item.un_number, mode: "exact" }, allRecords()); } catch {} let status = "NOT_FOUND"; if (candidates.length > 1) status = "MULTIPLE"; else if (candidates.length === 1 && candidates[0].identityConfirmed) { status = "CONFIRMED"; confirmedIds.push(candidates[0].id); } else if (candidates.length === 1) status = "INSUFFICIENT"; report[status === "CONFIRMED" ? "confirmed" : status === "MULTIPLE" ? "multiple" : status === "INSUFFICIENT" ? "insufficient" : "notFound"] += 1; return { ...item, matchStatus: status, candidateIds: candidates.map((candidate) => candidate.id) }; });
  confirmedIds.forEach(addRecordToProject); saveLocalState(); $("#importReport").hidden = false; $("#importReport").innerHTML = `<strong>导入 ${items.length} 条：</strong>已确认 ${report.confirmed}；多候选 ${report.multiple}；未找到 ${report.notFound}；资料不足 ${report.insufficient}。只有已确认记录进入矩阵，其余条目未丢弃并保存在本机待复核。`; renderMatrix(); event.target.value = "";
}
function downloadBlob(filename, content, type) { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function downloadTemplate() { downloadBlob("chemical-reactivity-import-template.csv", "input_name,cas_number,un_number,concentration,physical_form,supplier_product,sds_version,location\n", "text/csv;charset=utf-8"); }
async function exportWorkbook() {
  track("reactivity_export_started", { count: projectRecords().length, exportType: "xlsx" }); const allowed = await window.EhsSilVip?.hasCapability?.("chemical_reactivity_export");
  if (!allowed) { track("reactivity_upgrade_clicked", { count: projectRecords().length }); location.href = `/dashboard/register.html?returnTo=${encodeURIComponent(location.pathname)}`; return; }
  renderMatrix(); const project = activeProject(); const workbook = buildReactivityWorkbook(window.ExcelJS, { records: projectRecords(), matrix: state.matrix, summary: state.summary, manifest: state.manifest, project, scenario: currentScenario(), overrides: state.overrides, ruleVersion: state.config.ruleVersion, referenceToolVersion: state.config.referenceToolVersion });
  const buffer = await workbook.xlsx.writeBuffer(); downloadBlob(exportFilename(project.name), new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
function clearData() { if (!confirm("确定清除本工具保存在当前浏览器中的记录、项目、人工修订和导入清单吗？此操作无法恢复。")) return; localStorage.removeItem(state.config.storageKey); if (state.config.legacyStorageKey) localStorage.removeItem(state.config.legacyStorageKey); state.localRecords = []; state.importedPending = []; state.projects = []; state.overrides = []; state.storageError = null; ensureProject(); saveLocalState(); renderPairSelectors(); renderProjects(); renderScenario(); renderMatrix(); $("#singleResult").className = "crx-empty"; $("#singleResult").innerHTML = "<strong>本地数据已清除</strong><p>公开生产数据没有被修改。</p>"; }

function bindEvents() {
  $$('[data-tab]').forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("#openRecordForm").addEventListener("click", () => $("#recordDialog").showModal()); $("#recordForm").addEventListener("submit", saveRecord); $("#groupProxyForm").addEventListener("submit", saveGroupProxy); $("#scenarioForm").addEventListener("submit", saveScenario); $("#overrideForm").addEventListener("submit", saveOverride);
  $("#quickWaterButton").addEventListener("click", quickAddWater); $("#openGroupProxyButton").addEventListener("click", () => $("#groupProxyDialog").showModal());
  $("#searchButton").addEventListener("click", runSearch); let timer; $("#chemicalSearch").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 300); });
  $("#chemicalSearch").addEventListener("keydown", (event) => { const options = $$(".crx-candidate"); if (event.key === "ArrowDown" && options.length) { event.preventDefault(); options[0].focus(); } if (event.key === "Escape") $("#searchResults").hidden = true; });
  $("#searchResults").addEventListener("keydown", (event) => { const options = $$(".crx-candidate"), index = options.indexOf(document.activeElement); if (event.key === "ArrowDown" && index < options.length - 1) { event.preventDefault(); options[index + 1].focus(); } if (event.key === "ArrowUp") { event.preventDefault(); if (index > 0) options[index - 1].focus(); else $("#chemicalSearch").focus(); } if (event.key === "Escape") { $("#searchResults").hidden = true; $("#chemicalSearch").focus(); } });
  $("#checkPairButton").addEventListener("click", checkPair); $("#inventoryImport").addEventListener("change", handleImport); $("#downloadTemplateButton").addEventListener("click", downloadTemplate);
  $$('[data-matrix-view]').forEach((button) => button.addEventListener("click", () => { state.matrixView = button.dataset.matrixView; $$('[data-matrix-view]').forEach((item) => item.setAttribute("aria-pressed", String(item === button))); renderMatrix(); }));
  $("#newProjectButton").addEventListener("click", () => createNewProject(false)); $("#duplicateProjectButton").addEventListener("click", () => createNewProject(true)); $("#archiveProjectButton").addEventListener("click", archiveCurrentProject); $("#deleteProjectButton").addEventListener("click", deleteCurrentProject); $("#mixtureReportButton").addEventListener("click", renderMixtureReport);
  $("#printButton").addEventListener("click", () => { track("reactivity_export_started", { count: projectRecords().length, exportType: "print" }); window.print(); }); $("#exportButton").addEventListener("click", exportWorkbook); $("#clearDataButton").addEventListener("click", clearData);
  $("#closeDrawer").addEventListener("click", closeDrawer); $("#drawerBackdrop").addEventListener("click", closeDrawer);
  $$('[data-open-dialog]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.openDialog).showModal())); $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
  $$('[data-source-link]').forEach((link) => link.addEventListener("click", () => track("reactivity_source_opened", { status: link.dataset.sourceLink }))); document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
}

async function init() {
  try {
    const base = "../data/chemical-reactivity/", files = ["config.json", "source-manifest.json", "chemicals.index.json", "reactive-group-pairs.json", "direct-evidence.json", "consequences.json", "mixing-scenarios.json"];
    const [config, manifest, chemicals, groupPairs, directEvidence, consequences, mixingScenarios] = await Promise.all(files.map((file) => fetch(base + file).then((response) => { if (!response.ok) throw new Error(`${file} 加载失败`); return response.json(); })));
    Object.assign(state, { config, manifest, chemicals, groupPairs, directEvidence, consequences, mixingScenarios }); validateProductionData({ manifest, chemicals, groupPairs, directEvidence, mixingScenarios });
    if (config.sourceMode !== manifest.sourceMode) throw new Error("配置与数据清单模式不一致"); loadLocalState(); const batchMember = await window.EhsSilVip?.hasCapability?.("chemical_reactivity_batch"); state.matrixLimit = batchMember ? config.memberMatrixLimit : config.freeMatrixLimit;
    bindEvents(); renderVersion(); renderScenario(); renderPairSelectors(); renderProjects(); renderMatrix(); track("reactivity_tool_view");
  } catch (error) {
    $("#dataGate").innerHTML = `<div><strong>数据源不可用，已停止计算</strong><p>${escapeHtml(error.message)}。系统不会使用测试数据或陈旧缓存生成结论。</p></div><div class="crx-gate-actions"><a href="https://cameochemicals.noaa.gov/" target="_blank" rel="noopener">前往 CAMEO</a></div>`;
    $$(".crx-panel button,.crx-panel input,.crx-panel select").forEach((element) => { element.disabled = true; });
  }
}
init();

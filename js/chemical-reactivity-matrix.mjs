import {
  STATUS_META, validateProductionData, searchIdentityCandidates, predictChemicalPair,
  buildCompatibilityMatrix, summarizeMatrix, deriveStorageActions, createUserDraftRecord
} from "./chemical-reactivity-engine.mjs";
import { buildReactivityWorkbook, exportFilename } from "./chemical-reactivity-export.mjs";

const STORAGE_KEY = "ehs_sil_chemical_reactivity_v2";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const state = { config: null, manifest: null, chemicals: [], groupPairs: [], directEvidence: [], consequences: [], localRecords: [], importedPending: [], matrix: [], summary: null, storageError: null, matrixLimit: 10 };

function countBucket(count) { return count <= 10 ? "1-10" : count <= 50 ? "11-50" : "51+"; }
function track(event, { status = "", count = 0, exportType = "" } = {}) {
  window.EhsSilAnalytics?.track?.(event, {
    toolId: "chemical-reactivity-matrix", pageType: "other", sourceChannel: "site",
    resultBucket: count ? countBucket(count) : "", exportType,
    contentId: status ? `status_${String(status).toLowerCase()}` : ""
  });
}
function allRecords() { return [...state.chemicals, ...state.localRecords]; }
function confirmedRecords() { return allRecords().filter((record) => record.identityConfirmed); }
function matrixRecords() { return confirmedRecords().slice(0, state.matrixLimit); }
function dataContext() { return { groupPairs: state.groupPairs, directEvidence: state.directEvidence, sourceManifest: state.manifest }; }

function loadLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.records)) throw new Error("records 不是数组");
    state.localRecords = parsed.records;
    state.importedPending = Array.isArray(parsed.importedPending) ? parsed.importedPending : [];
  } catch (error) {
    state.storageError = { raw, message: error.message };
  }
}
function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, records: state.localRecords, importedPending: state.importedPending, savedAt: new Date().toISOString() }));
}

function setTab(name) {
  $$("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === name;
    button.setAttribute("aria-selected", String(active));
    document.getElementById(`${button.dataset.tab}Panel`).hidden = !active;
  });
  if (name === "pair") renderPairSelectors();
  if (name === "matrix") renderMatrix();
}

function renderVersion() {
  const span = $("#versionCard span");
  span.textContent = `${state.manifest.dataVersion} · ${state.manifest.sourceMode} · 已批准生产记录 ${state.manifest.approvedProductionRecordCount}`;
  if (state.storageError) {
    $("#dataGate").insertAdjacentHTML("afterbegin", `<div><strong>本地存储损坏，已停止读取</strong><p>${escapeHtml(state.storageError.message)}。请先下载原始数据或清除后重建清单。</p><button class="crx-btn secondary" id="downloadRawButton" type="button">下载原始数据</button></div>`);
    $("#downloadRawButton").addEventListener("click", () => downloadBlob("chemical-reactivity-corrupt-local-data.txt", state.storageError.raw, "text/plain"));
  }
}

function renderCandidateList(records) {
  const root = $("#searchResults");
  const input = $("#chemicalSearch");
  if (!records.length) {
    root.innerHTML = `<div class="crx-empty"><strong>未找到，不代表无禁忌</strong><p>请核对 CAS、浓度、物态和最新版 SDS，或使用上方 CAMEO/CRW 官方入口。</p></div>`;
    root.hidden = false;
    input.setAttribute("aria-expanded", "true");
    track("reactivity_unknown_result", { status: "not_found" });
    return;
  }
  root.innerHTML = records.map((record, index) => `<button type="button" class="crx-candidate" role="option" data-record-id="${escapeHtml(record.id)}" tabindex="${index ? -1 : 0}"><strong>${escapeHtml(record.preferredName)}</strong><span>${escapeHtml([record.casNumber, ...(record.unNumbers || []), record.substanceForm, record.concentrationNote, record.sourceRefs?.[0]?.version].filter(Boolean).join(" · "))}</span></button>`).join("");
  root.hidden = false;
  input.setAttribute("aria-expanded", "true");
  $$(".crx-candidate").forEach((button) => button.addEventListener("click", () => selectRecord(button.dataset.recordId)));
}

function runSearch() {
  const query = $("#chemicalSearch").value.trim();
  track("reactivity_search_started");
  if (!query) return renderCandidateList([]);
  const records = searchIdentityCandidates(query, allRecords());
  renderCandidateList(records);
}

function selectRecord(id) {
  const record = allRecords().find((item) => item.id === id);
  if (!record) return;
  $("#searchResults").hidden = true;
  $("#chemicalSearch").setAttribute("aria-expanded", "false");
  $("#chemicalSearch").value = record.preferredName;
  renderSingleResult(record);
  track("reactivity_identity_confirmed", { status: record.identityConfirmed ? "confirmed" : "needs_confirmation" });
}

function listHtml(items, emptyText) {
  return items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.summary || item.title || "")}</li>`).join("")}</ul>` : `<p>${escapeHtml(emptyText)}</p>`;
}
function renderSingleResult(record) {
  const source = record.sourceRefs?.[0] || {};
  $("#singleResult").className = "";
  $("#singleResult").innerHTML = `
    <article class="crx-identity-card"><div><h3>${escapeHtml(record.preferredName)}</h3><div class="crx-meta"><span>${escapeHtml(record.casNumber || "CAS 未提供")}</span><span>${escapeHtml((record.unNumbers || []).join("、") || "UN/NA 未提供")}</span><span>${escapeHtml(record.substanceForm || "物态未提供")}</span><span>${escapeHtml(record.concentrationNote || "浓度/配方未提供")}</span></div><p class="crx-disclaimer">来源：${escapeHtml(source.sourceId || "未知")} · ${escapeHtml(source.version || "无版本")} · 记录 ${escapeHtml(source.recordId || record.id)}</p></div><span class="crx-layer">${escapeHtml(record.evidenceLayer || "官方/外部数据库")}</span></article>
    ${record.identityConfirmed ? "" : `<div class="crx-status-card" data-status="UNKNOWN"><strong>身份未确认：阻断两两计算与正式矩阵</strong><p>请核对具体记录、浓度/物态与最新版 SDS 后重新录入确认。</p></div>`}
    <div class="crx-card-grid"><article class="crx-evidence-card"><h3>最高优先级反应性红旗</h3>${listHtml(record.reactivityAlerts, "当前记录没有已录入警示；不代表没有反应性危险。")}</article><article class="crx-evidence-card"><h3>具体禁忌物</h3>${listHtml(record.directIncompatibilities, "当前记录没有已录入禁忌物；请核对 SDS 第 10 节和官方工具。")}</article><article class="crx-evidence-card"><h3>禁忌反应类别 / 反应组</h3>${listHtml(record.reactiveGroupIds, "反应组资料不足，任何组对计算将保持 UNKNOWN。")}</article><article class="crx-evidence-card"><h3>储存与现场核实</h3><ul><li>核对空气、水、热、冲击、摩擦、自聚合和自分解信息</li><li>核对吸附剂、设备材料、消防介质和共用排液</li><li>按 GB 15603—2022、最新版 SDS 和企业制度由合格人员确定</li></ul></article></div>
    <div class="crx-report-actions"><button class="crx-btn secondary" type="button" data-add-pair="${escapeHtml(record.id)}">加入配伍检查</button><button class="crx-btn primary" type="button" data-add-matrix="${escapeHtml(record.id)}">查看库存矩阵</button></div>`;
  $("[data-add-pair]")?.addEventListener("click", () => { setTab("pair"); $("#pairA").value = record.id; });
  $("[data-add-matrix]")?.addEventListener("click", () => setTab("matrix"));
}

function renderPairSelectors() {
  const records = confirmedRecords();
  const options = [`<option value="">请选择已确认记录</option>`, ...records.map((record) => `<option value="${escapeHtml(record.id)}">${escapeHtml(record.preferredName)}</option>`)].join("");
  [$("#pairA"), $("#pairB")].forEach((select) => { const current = select.value; select.innerHTML = options; if (records.some((record) => record.id === current)) select.value = current; });
  if (records.length > 1 && !$("#pairB").value) $("#pairB").value = records[1].id;
  $("#inventoryCount").textContent = String(records.length);
}

function consequenceLabel(id) { return state.consequences.find((item) => item.id === id)?.labelZh || id; }
function resultMarkup(result) {
  const actions = deriveStorageActions(result);
  result.storageActions = actions;
  const sources = result.sourceRefs.length ? result.sourceRefs.map((source) => `${source.sourceId}/${source.recordId || "-"}/${source.version}`) : ["当前没有可追溯的组对来源"];
  const evidence = result.evidence.length ? result.evidence.map((item) => `${item.evidenceType === "DIRECT" ? "直接资料" : `反应组 ${item.key}`}：${item.summary}`) : ["没有已批准的直接证据或组对规则"];
  return `<article class="crx-status-card" data-status="${result.status}"><div class="crx-status-title"><div><p>${escapeHtml(result.chemicalA.name)} ＋ ${escapeHtml(result.chemicalB.name)}</p><h3>${result.statusMeta.icon} ${escapeHtml(result.statusMeta.label)}</h3></div><span class="crx-status-badge">${result.status}</span></div><div class="crx-result-grid"><div><strong>主要后果</strong>${listHtml(result.consequenceTags.map(consequenceLabel), "没有获准数据支持具体后果；不得据此判为安全。")}</div><div><strong>可能气体 / 产物</strong>${listHtml(result.possibleGases, "无已批准气体数据；系统不会猜测。")}</div><div><strong>全部证据与组对</strong>${listHtml(evidence, "无")}</div><div><strong>未知项与缺口</strong>${listHtml([...result.missingGroupPairs, ...result.uncertaintyFlags], "当前组对数据完整。")}</div><div><strong>下一步</strong>${listHtml(actions, "由合格人员复核")}</div><div><strong>来源与版本</strong>${listHtml(sources, "无")}</div></div>${result.escalateProcessSafety ? `<div class="crx-disclaimer"><strong>升级工艺安全评估：</strong>${escapeHtml(result.escalationReasons.join("；"))}。建议 PHA/HAZOP/What-if、反应量热或热分析、MOC 以及联锁/泄压复核。</div>` : ""}<div class="crx-disclaimer">${escapeHtml(result.disclaimer)}</div></article>`;
}

function checkPair() {
  const a = confirmedRecords().find((record) => record.id === $("#pairA").value);
  const b = confirmedRecords().find((record) => record.id === $("#pairB").value);
  if (!a || !b || a.id === b.id) {
    $("#pairResult").className = "crx-empty";
    $("#pairResult").innerHTML = "<strong>请选择两个不同且已确认身份的记录</strong><p>模糊身份不会进入相容性计算。</p>";
    return;
  }
  const result = predictChemicalPair(a, b, dataContext());
  $("#pairResult").className = "";
  $("#pairResult").innerHTML = resultMarkup(result);
  track("reactivity_pair_checked", { status: result.status });
  if (result.status === "UNKNOWN") track("reactivity_unknown_result", { status: result.status });
}

function renderMatrix() {
  const confirmed = confirmedRecords();
  const records = matrixRecords();
  $("#inventoryCount").textContent = String(confirmed.length);
  if (!records.length) {
    $("#matrixTableRoot").innerHTML = `<div class="crx-empty"><strong>库存清单为空</strong><p>先录入并确认身份；导入条目默认待确认，不会直接进入正式矩阵。</p></div>`;
    $("#matrixSummary").innerHTML = ""; $("#anomalyList").innerHTML = ""; return;
  }
  state.matrix = buildCompatibilityMatrix(records, dataContext());
  state.summary = summarizeMatrix(state.matrix);
  state.summary.pairs.forEach((pair) => { pair.storageActions = deriveStorageActions(pair); });
  const labels = { INCOMPATIBLE: "不相容", CAUTION: "谨慎", UNKNOWN: "未知", CONFLICT_REVIEW: "冲突", NO_PREDICTED_HAZARD: "未预测", NOT_APPLICABLE: "不适用" };
  $("#matrixSummary").innerHTML = `${confirmed.length > records.length ? `<span>已确认 ${confirmed.length} 条；当前上限 ${state.matrixLimit} 条，超限记录未丢失</span>` : ""}${Object.entries(state.summary.counts).filter(([status]) => status !== "NOT_APPLICABLE").map(([status, count]) => `<span>${labels[status]} ${count}</span>`).join("")}`;
  const head = records.map((record) => `<th scope="col" title="${escapeHtml(record.preferredName)}">${escapeHtml(record.preferredName)}</th>`).join("");
  const rows = records.map((record, i) => `<tr><th scope="row" title="${escapeHtml(record.preferredName)}">${escapeHtml(record.preferredName)}</th>${state.matrix[i].map((cell, j) => `<td><button class="crx-cell ${cell.status}" type="button" data-cell="${i}:${j}" aria-label="${escapeHtml(record.preferredName)} 与 ${escapeHtml(records[j].preferredName)}：${escapeHtml(STATUS_META[cell.status].label)}">${STATUS_META[cell.status].icon} ${escapeHtml(labels[cell.status])}</button></td>`).join("")}</tr>`).join("");
  $("#matrixTableRoot").innerHTML = `<table class="crx-matrix"><thead><tr><th scope="col">化学品</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  $("#anomalyList").innerHTML = `<h3>异常组合列表</h3>${state.summary.pairs.map((pair, index) => `<button class="crx-anomaly" type="button" data-pair-index="${index}"><span>${escapeHtml(pair.chemicalA.name)} ＋ ${escapeHtml(pair.chemicalB.name)}</span><strong>${pair.statusMeta.icon} ${escapeHtml(pair.statusMeta.label)}</strong></button>`).join("")}`;
  $$("[data-cell]").forEach((button) => button.addEventListener("click", () => { const [i, j] = button.dataset.cell.split(":").map(Number); if (i !== j) openDrawer(state.matrix[i][j]); }));
  $$("[data-pair-index]").forEach((button) => button.addEventListener("click", () => openDrawer(state.summary.pairs[Number(button.dataset.pairIndex)])));
  track("reactivity_matrix_generated", { count: records.length });
}

function openDrawer(result) {
  $("#drawerTitle").textContent = `${result.chemicalA.name} ＋ ${result.chemicalB.name}`;
  $("#drawerBody").innerHTML = resultMarkup(result);
  $("#detailDrawer").classList.add("open"); $("#detailDrawer").setAttribute("aria-hidden", "false"); $("#drawerBackdrop").hidden = false; $("#closeDrawer").focus();
}
function closeDrawer() { $("#detailDrawer").classList.remove("open"); $("#detailDrawer").setAttribute("aria-hidden", "true"); $("#drawerBackdrop").hidden = true; }

function saveRecord(event) {
  event.preventDefault();
  const form = $("#recordForm");
  const values = Object.fromEntries(new FormData(form));
  values.mixtureFlag = values.mixtureFlag === "true";
  values.identityConfirmed = values.identityConfirmed === "on";
  try {
    const record = createUserDraftRecord(values);
    state.localRecords.push(record); saveLocalState(); form.reset(); $("#recordDialog").close(); renderPairSelectors();
    $("#chemicalSearch").value = record.preferredName; renderSingleResult(record);
  } catch (error) { $("#recordError").textContent = error.message; }
}

function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(field); if (row.some((value) => value.trim())) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
function rowsToObjects(rows) {
  const headers = (rows.shift() || []).map((value) => String(value || "").trim());
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()]))).filter((item) => item.input_name);
}
async function handleImport(event) {
  const file = event.target.files?.[0]; if (!file) return;
  let rows;
  if (/\.xlsx$/i.test(file.name)) {
    const workbook = new window.ExcelJS.Workbook(); await workbook.xlsx.load(await file.arrayBuffer());
    rows = []; workbook.worksheets[0].eachRow((row) => rows.push(row.values.slice(1).map((value) => value?.text || value || "")));
  } else rows = parseCsv(await file.text());
  const items = rowsToObjects(rows);
  const report = { confirmed: 0, multiple: 0, notFound: 0, insufficient: 0 };
  state.importedPending = items.map((item) => {
    const candidates = searchIdentityCandidates({ name: item.input_name, cas: item.cas_number, un: item.un_number }, allRecords());
    let status = "NOT_FOUND";
    if (candidates.length > 1) status = "MULTIPLE";
    else if (candidates.length === 1 && candidates[0].identityConfirmed) status = "CONFIRMED";
    else if (candidates.length === 1) status = "INSUFFICIENT";
    report[status === "CONFIRMED" ? "confirmed" : status === "MULTIPLE" ? "multiple" : status === "INSUFFICIENT" ? "insufficient" : "notFound"] += 1;
    return { ...item, matchStatus: status, candidateIds: candidates.map((candidate) => candidate.id) };
  });
  saveLocalState();
  $("#importReport").hidden = false;
  $("#importReport").innerHTML = `<strong>导入 ${items.length} 条：</strong>已确认 ${report.confirmed}；多候选 ${report.multiple}；未找到 ${report.notFound}；资料不足 ${report.insufficient}。只有已确认记录进入矩阵，其余条目未丢弃并保存在本机待复核。`;
  renderMatrix(); event.target.value = "";
}

function downloadBlob(filename, content, type) { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function downloadTemplate() { downloadBlob("chemical-reactivity-import-template.csv", "input_name,cas_number,un_number,concentration,physical_form,supplier_product,sds_version,location\n", "text/csv;charset=utf-8"); }
async function exportWorkbook() {
  track("reactivity_export_started", { count: confirmedRecords().length, exportType: "xlsx" });
  const allowed = await window.EhsSilVip?.hasCapability?.("chemical_reactivity_export");
  if (!allowed) { track("reactivity_upgrade_clicked", { count: confirmedRecords().length }); location.href = `/dashboard/register.html?returnTo=${encodeURIComponent(location.pathname)}`; return; }
  if (!state.summary) renderMatrix();
  const workbook = buildReactivityWorkbook(window.ExcelJS, { records: confirmedRecords(), matrix: state.matrix, summary: state.summary || { pairs: [] }, manifest: state.manifest });
  const buffer = await workbook.xlsx.writeBuffer(); downloadBlob(exportFilename(), new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

function clearData() {
  if (!confirm("确定清除本工具保存在当前浏览器中的记录和导入清单吗？此操作无法恢复。")) return;
  localStorage.removeItem(STORAGE_KEY); state.localRecords = []; state.importedPending = []; state.storageError = null; renderPairSelectors(); renderMatrix();
  $("#singleResult").className = "crx-empty"; $("#singleResult").innerHTML = "<strong>本地数据已清除</strong><p>公开生产数据没有被修改。</p>";
}

function bindEvents() {
  $$("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("#openRecordForm").addEventListener("click", () => $("#recordDialog").showModal()); $("#recordForm").addEventListener("submit", saveRecord);
  $("#searchButton").addEventListener("click", runSearch); let timer; $("#chemicalSearch").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 300); });
  $("#chemicalSearch").addEventListener("keydown", (event) => { const options = $$(".crx-candidate"); if (event.key === "ArrowDown" && options.length) { event.preventDefault(); options[0].focus(); } if (event.key === "Escape") $("#searchResults").hidden = true; });
  $("#searchResults").addEventListener("keydown", (event) => { const options = $$(".crx-candidate"); const index = options.indexOf(document.activeElement); if (event.key === "ArrowDown" && index < options.length - 1) { event.preventDefault(); options[index + 1].focus(); } if (event.key === "ArrowUp") { event.preventDefault(); if (index > 0) options[index - 1].focus(); else $("#chemicalSearch").focus(); } if (event.key === "Escape") { $("#searchResults").hidden = true; $("#chemicalSearch").focus(); } });
  $("#checkPairButton").addEventListener("click", checkPair); $("#inventoryImport").addEventListener("change", handleImport); $("#downloadTemplateButton").addEventListener("click", downloadTemplate);
  $("#printButton").addEventListener("click", () => { track("reactivity_export_started", { count: confirmedRecords().length, exportType: "print" }); window.print(); }); $("#exportButton").addEventListener("click", exportWorkbook); $("#clearDataButton").addEventListener("click", clearData);
  $("#closeDrawer").addEventListener("click", closeDrawer); $("#drawerBackdrop").addEventListener("click", closeDrawer);
  $$('[data-open-dialog]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.openDialog).showModal())); $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
  $$('[data-source-link]').forEach((link) => link.addEventListener("click", () => track("reactivity_source_opened", { status: link.dataset.sourceLink })));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
}

async function init() {
  try {
    const base = "../data/chemical-reactivity/";
    const [config, manifest, chemicals, groupPairs, directEvidence, consequences] = await Promise.all(["config.json", "source-manifest.json", "chemicals.index.json", "reactive-group-pairs.json", "direct-evidence.json", "consequences.json"].map((file) => fetch(base + file).then((response) => { if (!response.ok) throw new Error(`${file} 加载失败`); return response.json(); })));
    Object.assign(state, { config, manifest, chemicals, groupPairs, directEvidence, consequences });
    validateProductionData({ manifest, chemicals, groupPairs, directEvidence });
    if (config.sourceMode !== manifest.sourceMode) throw new Error("配置与数据清单模式不一致");
    loadLocalState();
    const batchMember = await window.EhsSilVip?.hasCapability?.("chemical_reactivity_batch");
    state.matrixLimit = batchMember ? config.memberMatrixLimit : config.freeMatrixLimit;
    bindEvents(); renderVersion(); renderPairSelectors(); renderMatrix();
    track("reactivity_tool_view");
  } catch (error) {
    $("#dataGate").innerHTML = `<div><strong>数据源不可用，已停止计算</strong><p>${escapeHtml(error.message)}。系统不会使用测试数据或陈旧缓存生成结论。</p></div><div class="crx-gate-actions"><a href="https://cameochemicals.noaa.gov/" target="_blank" rel="noopener">前往 CAMEO</a></div>`;
    $$(".crx-panel button,.crx-panel input,.crx-panel select").forEach((element) => { element.disabled = true; });
  }
}

init();

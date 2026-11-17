import {
  APP_VERSION,
  DATA_VERSION,
  clone,
  parseProjectText,
  CONDITION_LABELS,
  kelvinFromC,
  paFromKpa,
} from "./schema.mjs";
import { createPreset, deriveQuantity, equipmentById } from "./presets.mjs";
import { previewChange, applyChange, undoLastChange } from "./controller.mjs";
import { buildSceneSpec, sampleStoryboard } from "./scene-spec.mjs";
import {
  load,
  save,
  savePrevious,
  loadPrevious,
  clear,
  LEGACY_KEY,
  ORIGINAL_V011_KEY,
} from "./storage.mjs";
import { acceptsResult, freezeA, compare } from "./engine.mjs";
import { render2d, escape } from "./view-2d.mjs";
import { csv, report, download } from "./export.mjs";

const $ = (id) => document.getElementById(id),
  on = (id, event, fn) => $(id).addEventListener(event, fn),
  num = (id) => ($(id).value === "" ? null : Number($(id).value));
let catalogs,
  project,
  draft = null,
  result = null,
  spec,
  frame,
  worker,
  activeId = null,
  mode = "example",
  undo = null,
  previousDraft = null,
  importCandidate = null,
  legacyRaw = null,
  originalV011Raw = null,
  storageBlocked = false,
  dirty = false;
let progress = 0,
  playing = false,
  last = 0,
  clock = 0,
  view = null,
  viewRequest = 0,
  viewMode = "2d",
  dialogType = null,
  pendingCommand = null,
  importGeneration = 0;
let controlEdits = new Map(),
  assumptionEdited = false;
let exportingFrame = false, frameExportGeneration = 0, lastFrameMetadata = null, lastUiStage = -1;
let displayView = null, appliedDisplay = {};
let playbackIntent = 0;
const controlNames = [
  "减少库存",
  "围堵与排液",
  "有效隔离 / 切断",
  "报警器 / SIS",
  "喷淋 / 泡沫",
  "培训与程序",
  "PPE / 疏散",
];
const quantities = {
  mass: ["inventoryKg", "kg"],
  volume: ["volumeM3", "m³"],
  fill: ["fillFraction", "%"],
};
const sourceLabel = (p) =>
  p.provenance["inputs.storage.volumeM3"]?.kind === "user_input"
    ? "用户输入"
    : "教学示例 / 当前记录";
function notice(text) {
  $("notice").textContent = text;
}
function showConditions(show = true) {
  $("conditions-sidebar").hidden = !show;
  $("scene-layout").classList.toggle("has-conditions", show);
  $("toggle-conditions").setAttribute("aria-expanded", String(show));
  $("toggle-conditions").textContent = show ? "收起条件" : "调整条件";
}
function presetName(p) {
  const labels = {"pool-fire":"池火", "jet-fire":"喷射火", "flash-fire":"闪火", "vce":"蒸气云爆炸", "vapor-cloud-explosion":"蒸气云爆炸", "confined-deflagration":"空间爆燃"};
  return `${labels[p.scenarioId] || "场景"} · ${catalogs.chemicals.materials.find(m=>m.id===p.materialRef)?.name || "预设物料"}`;
}
function renderPresetGallery() {
  $("preset-gallery").innerHTML = catalogs.presets.presets
    .filter(p=>p.presetId!=="ethanol-atmospheric-tank-pool-fire")
    .sort((a,b)=>(a.materialRef==='methanol'?-1:0)-(b.materialRef==='methanol'?-1:0))
    .map(p=>`<button type="button" class="sc-preset-card" data-preset-id="${escape(p.presetId)}" aria-current="${p.presetId===project.meta.presetId}"><span class="sc-preset-thumb" aria-hidden="true" data-kind="${escape(p.materialRef==='methanol'?'methanol':p.scenarioId)}"></span><b>${escape(presetName(p))}</b><small>${escape(catalogs.equipment.equipment.find(e=>e.id===p.equipmentRef)?.name || "教学设备")}</small><small>查看条件并载入 ↗</small></button>`).join("");
}
function syncDisplayPreferences() {
  if (!view) return;
  if (displayView !== view) { displayView = view; appliedDisplay = {}; }
  const values = {quality:project.ui.quality || "balanced", labels:Boolean(project.ui.labels), labelDetail:Boolean(project.ui.labelDetail), cutaway:Boolean(project.ui.cutaway), pressureAux:Boolean(project.ui.pressureAux)};
  const methods = {quality:"setQuality",labels:"setLabelsVisible",labelDetail:"setLabelDetail",cutaway:"setCutaway",pressureAux:"setPressureVisible"};
  for (const [key,value] of Object.entries(values)) if(appliedDisplay[key]!==value) { view[methods[key]]?.(value); appliedDisplay[key]=value; }
}
function currentDefinition() {
  return catalogs.scenarios.scenarios.find(
    (s) => s.id === project.inputs.scenario.id,
  );
}
function updateMetrics() {
  if (!$("workspace")) return;
  $("workspace").dataset.inputRevision = String(project.inputRevision);
  $("workspace").dataset.activeClocks = playing ? "1" : "0";
}
function stop() {
  playbackIntent++;
  if ($("view-status").textContent === "正在准备三维教学…")
    $("view-status").textContent = "播放准备已取消，可再次选择播放或切换视图。";
  playing = false;
  cancelAnimationFrame(clock);
  clock = 0;
  last = 0;
  $("play").textContent = "播放";
  updateMetrics();
}
function persist() {
  if (mode === "example") {
    $("save-status").textContent = "示例未写入草稿";
    return true;
  }
  dirty = true;
  if (storageBlocked) {
    $("save-status").textContent = "未保存，请下载 JSON 备份";
    return false;
  }
  let status;
  try {
    status = save(localStorage, project);
  } catch (e) {
    status = { status: "failed", error: e.message };
  }
  if (status.status === "saved") {
    draft = clone(project);
    dirty = false;
    $("save-status").textContent = "已保存到本浏览器";
    $("continue-draft").hidden = false;
    return true;
  }
  $("save-status").textContent = "未保存：" + (status.error || "存储不可用");
  notice("当前内容保留在内存，请下载 JSON；原始旧版记录仍保留。");
  return false;
}
function backup(p) {
  previousDraft = clone(p);
  $("restore-previous").hidden = false;
  try {
    const status = savePrevious(localStorage, p);
    if (status.status !== "saved") throw Error(status.error);
    return true;
  } catch (e) {
    notice(
      "备份未成功：" +
        e.message +
        "。当前内容保留，请先下载 JSON；未覆盖原草稿。",
    );
    return false;
  }
}
function ensureEditable() {
  if (mode === "draft") return;
  if (draft && !backup(draft)) storageBlocked = true;
  project = clone(project);
  project.meta.id = crypto.randomUUID();
  project.meta.createdAt = new Date().toISOString();
  mode = "draft";
}
function scenarioHeading() {
  const d = currentDefinition();
  return `${project.inputs.material.name || "未填写物料"} · ${d.name}`;
}
function fillControlEditor() {
  const type = $("control-record-select").value,
    c = controlEdits.get(type) || project.controls.find((c) => c.type === type);
  $("boundary").value = c?.boundary || "";
  $("controlEvidence").value = c?.evidence || "";
  $("actionTimeS").value = c?.actionTimeS ?? "";
}
function controlOptions() {
  const selected = $("control-record-select").value,
    items = controlNames.filter((_, i) => $(`control-${i}`).checked);
  $("control-record-select").innerHTML = items.length
    ? items
        .map(
          (type) => `<option value="${escape(type)}">${escape(type)}</option>`,
        )
        .join("")
    : '<option value="">先勾选一项措施</option>';
  if (items.includes(selected)) $("control-record-select").value = selected;
  fillControlEditor();
}
function fillCommon() {
  const s = project.inputs.storage,
    g = project.inputs.equipment.geometry,
    b = project.inputs.equipment.containment;
  $("quantity-basis").value = s.quantityBasis;
  const q = s[quantities[s.quantityBasis][0]];
  $("quantity-value").value =
    q === null ? "" : s.quantityBasis === "fill" ? q * 100 : q;
  $("quantity-label").textContent = `库存（${quantities[s.quantityBasis][1]}）`;
  $("temperature").value =
    project.inputs.material.temperatureK === null
      ? ""
      : Number((project.inputs.material.temperatureK - 273.15).toFixed(6));
  $("pressure").value = s.pressurePa === null ? "" : s.pressurePa / 1000;
  $("pressure-mode").value = s.pressureMode;
  $("title").value = project.meta.title;
  $("composition").value = project.inputs.material.composition;
  $("state").value = project.inputs.material.state;
  const e = equipmentById(catalogs, project.inputs.equipment.id);
  $("leak-anchor").innerHTML =
    '<option value="">未选择</option>' +
    (e?.leakAnchors || [])
      .map(
        (a) =>
          `<option value="${escape(a)}">${a === "valve-downstream" ? "根部阀后短管" : a === "tank-wall" ? "罐壁（仅机制）" : escape(a)}</option>`,
      )
      .join("");
  $("leak-anchor").value = project.inputs.equipment.leakAnchor || "";
  $("diameterM").value = g.diameterM ?? "";
  $("heightM").value = g.heightM ?? "";
  $("containment-length").value = b.lengthM ?? "";
  $("containment-width").value = b.widthM ?? "";
  $("pool-radius").value = project.inputs.pool.radiusM ?? "";
  $("evidenceNotes").value = project.evidenceNotes;
  $("assumption").value =
    project.assumptions.find((a) => a.source === "用户补充")?.text || "";
  controlEdits = new Map();
  assumptionEdited = false;
  for (let i = 0; i < controlNames.length; i++)
    $(`control-${i}`).checked = project.controls.some(
      (c) => c.type === controlNames[i],
    );
  controlOptions();
  for (const k of Object.keys(CONDITION_LABELS)) {
    $(`condition-${k}`).value = project.inputs.scenario.conditions[k];
    $(`condition-${k}`).closest("label").hidden =
      !currentDefinition().conditions.includes(k);
  }
  const d = deriveQuantity(project);
  $("derived-quantity").textContent =
    `${sourceLabel(project)}。教学几何容量 ${d.capacityM3 === null ? "未知" : d.capacityM3.toFixed(2) + " m³"}；液位 ${d.liquidLevelM === null ? "未知（不使用密度补算）" : d.liquidLevelM.toFixed(2) + " m（示意）"}。`;
}
function renderResult() {
  const current =
    result &&
    result.status !== "stale" &&
    result.inputRevision === project.inputRevision;
  $("result-state").textContent = activeId
    ? "检查中…"
    : current
      ? "仅教学演示"
      : "待检查 / 待重算";
  if (!current) {
    $("result-content").textContent =
      "教学画面来自当前输入。没有当前可信检查，导出不带旧结果或旧哈希。";
    return;
  }
  const c = result.conditions;
  $("result-content").innerHTML =
    `<p>${c.status === "candidate" ? "可作为候选场景，需核实前提" : "需要补充或复核条件"}</p><p>${escape([...c.missing, ...c.contrary].join("、") || c.explanation)}</p><p>热辐射、超压、浓度、持续时间、事故频率与个人风险：全部未评估。</p>`;
}
function renderComparison() {
  const c = compare(project.comparison, project);
  $("comparison").innerHTML =
    `<p>${escape(c.message)}</p>${project.comparison ? `<p>A：${escape(project.comparison.project.inputs.material.name)} / ${escape(project.comparison.project.inputs.scenario.id)}，修订 ${project.comparison.inputRevision}；B：${escape(scenarioHeading())}，修订 ${project.inputRevision}。</p>` : ""}${c.differences.length ? `<p class="sc-muted">条件可比较，工程量未评估。表格可横向滚动，数值使用 kg / m³ / Pa / K / m。</p><div class="sc-table-wrap"><table><thead><tr><th>字段</th><th>方案 A</th><th>方案 B</th></tr></thead><tbody>${c.differences.map((d) => `<tr><td>${escape(d.field)}</td><td>${escape(d.a)}</td><td>${escape(d.b)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="sc-muted">冻结 A 后再修改 B；不计算风险降低百分比。</p>'}`;
}
function draw() {
  frame = sampleStoryboard(spec, progress, 1);
  project.ui.stage = frame.stage;
  if (viewMode === "2d") render2d($("view-2d-host"), spec, frame);
  if (viewMode === "3d") view?.update(spec, frame);
  const stage = spec.stages[frame.stage];
  $("timeline").value = String(progress);
  $("stage-number").textContent = spec.support.canPlayDetailedStoryboard
    ? `第 ${frame.stage + 1} / ${spec.stages.length} 阶段 · 教学进度`
    : "独立机制教学";
  if (lastUiStage !== frame.stage) {
    lastUiStage = frame.stage;
    $("stage-title").textContent = stage.title;
    $("stage-text").textContent = stage.text;
    $("stage-question").textContent = stage.question || "";
    for (const b of $("stages").children) b.setAttribute("aria-current", String(Number(b.dataset.stage) === frame.stage));
  }
}
function render() {
  spec = buildSceneSpec(project, catalogs);
  lastUiStage = -1;
  document.title = `${scenarioHeading()} · 写实场景工作台 | EHS-SIL`;
  $("play-example").textContent = spec.support.canPlayDetailedStoryboard ? '播放事故过程 ↗' : '查看当前机制 ↗';
  $("scene-title").textContent = scenarioHeading();
  $("bar-material").textContent = project.inputs.material.name || "未填写";
  $("bar-equipment").textContent = project.inputs.equipment.name;
  const s = project.inputs.storage,
    q = s[quantities[s.quantityBasis][0]],
    temp = project.inputs.material.temperatureK;
  $("bar-storage").textContent =
    `${q === null ? "未填写" : s.quantityBasis === "fill" ? (q * 100).toFixed(1) : q} ${quantities[s.quantityBasis][1]} · ${temp === null ? "未填写" : Number((temp - 273.15).toFixed(2)) + "°C"} · ${s.pressureMode === "atmospheric" ? "常压" : s.pressurePa === null ? "压力未填写" : s.pressurePa / 1000 + " kPa绝压"}`;
  $("bar-scenario").textContent = currentDefinition().name;
  $("mode-label").textContent =
    mode === "example" ? "教学示例 · 未写入个人草稿" : "个人草稿";
  $("visual-mode").value = project.ui.visualMode;
  $("camera-select").value = project.ui.camera;
  $("speed").value = String(project.ui.speed);
  $("show-labels").checked = project.ui.labels;
  $("quality").value = project.ui.quality || "balanced";
  $("cutaway").checked = Boolean(project.ui.cutaway);
  $("pressure-aux").checked = Boolean(project.ui.pressureAux);
  $("label-detail").checked = Boolean(project.ui.labelDetail);
  $("cutaway").disabled = spec.sceneId !== "confined-deflagration";
  $("pressure-aux").disabled = !["vce", "vapor-cloud-explosion", "confined-deflagration"].includes(spec.sceneId);
  syncDisplayPreferences();
  renderPresetGallery();
  $("visual-note").textContent = spec.visual.note;
  $("material-note").textContent = spec.visual.profile.description;
  const refs = new Set(spec.visual.profile.sourceRefs || []);
  $("source-links").replaceChildren();
  for (const source of catalogs.sources.sources.filter(
    (s) => refs.has(s.id) && s.url,
  )) {
    const a = document.createElement("a");
    a.href = source.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = source.title + " ↗";
    $("source-links").append(a);
  }
  $("support-note").textContent = spec.support.issues.length
    ? spec.support.issues.map((i) => i.message).join(" ")
    : "三维体积与事件为预设视觉过程，未计算泄漏量、浓度、超压或后果距离。";
  $("load-compatible").hidden = spec.support.canPlayDetailedStoryboard || !catalogs.presets.presets.some(p=>p.scenarioId===spec.sceneId);
  $("stages").innerHTML = spec.support.canPlayDetailedStoryboard
    ? spec.stages
        .map(
          (s, i) =>
            `<button data-stage="${i}" type="button">${i + 1} ${escape(s.title)}</button>`,
        )
        .join("")
    : "";
  for (const id of ["play", "replay", "timeline", "view-3d"])
    $(id).disabled = !spec.support.canPlayDetailedStoryboard;
  if (!spec.support.canPlayDetailedStoryboard && viewMode === "3d") to2d();
  const d = currentDefinition();
  $("mechanism-detail").innerHTML =
    `<p>${escape(d.mechanism)}</p><p>${escape(d.difference)}</p><p>${escape(d.data)}</p>`;
  $("undo").disabled = !undo;
  updateMetrics();
  draw();
  renderResult();
  renderComparison();
  fillCommon();
}
function invalidate() {
  frameExportGeneration++;
  lastFrameMetadata = null;
  $("export-frame-meta").disabled = true;
  activeId = null;
  if (result) result = { ...result, status: "stale" };
}
function run() {
  activeId = crypto.randomUUID();
  worker.postMessage({
    project: clone(project),
    definition: currentDefinition(),
    calculationId: activeId,
  });
  renderResult();
}
function apply(command) {
  try {
    if (
      command.type === "preset" &&
      dirty &&
      !confirm("当前有未保存修改。将先保留原草稿，再载入整套示例；继续吗？")
    )
      return false;
    const candidate = applyChange(project, command, catalogs);
    if (!candidate.changed && command.type !== "preset") {
      notice("条件未改变，保留当前检查结果。");
      return true;
    }
    if (
      command.type === "preset" &&
      !backup(mode === "example" && draft ? draft : project)
    )
      return false;
    stop();
    ensureEditable();
    importGeneration++;
    importCandidate = null;
    $("import-preview").hidden = true;
    const id = project.meta.id,
      createdAt = project.meta.createdAt;
    project = candidate.project;
    project.meta.id = id;
    project.meta.createdAt = createdAt;
    undo = candidate.previous;
    progress = 0;
    invalidate();
    render();
    persist();
    run();
    if (command.type === "preset" && spec.support.canPlayDetailedStoryboard && viewMode !== "3d") void to3d();
    notice(
      command.type === "preset"
        ? "整套示例已载入；原草稿与冻结 A 已保留。"
        : "修改已应用。兼容条件保留，可撤销本次修改。",
    );
    return true;
  } catch (e) {
    notice(e.message);
    return false;
  }
}
function commonCommand() {
  const basis = $("quantity-basis").value;
  let quantity = num("quantity-value");
  if (basis === "fill" && quantity !== null) quantity /= 100;
  const selected = new Set(
      controlNames.filter((_, i) => $(`control-${i}`).checked),
    ),
    updated = new Set();
  const controls = project.controls.flatMap((c) => {
    if (!controlNames.includes(c.type)) return [clone(c)];
    if (!selected.has(c.type)) return [];
    if (controlEdits.has(c.type) && !updated.has(c.type)) {
      updated.add(c.type);
      return [{ ...clone(c), ...controlEdits.get(c.type) }];
    }
    return [clone(c)];
  });
  for (const type of selected)
    if (!controls.some((c) => c.type === type))
      controls.push({
        type,
        target: "释放 / 围堵 / 暴露环节，需复核",
        boundary: "",
        actionTimeS: null,
        evidence: "",
        status: "recorded_only",
        ...(controlEdits.get(type) || {}),
      });
  let assumptions = clone(project.assumptions);
  if (assumptionEdited) {
    const index = assumptions.findIndex((a) => a.source === "用户补充"),
      text = $("assumption").value;
    if (index < 0) {
      if (text)
        assumptions.push({ text, source: "用户补充", confirmed: false });
    } else if (text)
      assumptions[index] = { ...assumptions[index], text, confirmed: false };
    else assumptions.splice(index, 1);
  }
  const patch = {
    "meta.title": $("title").value,
    "inputs.material.composition": $("composition").value,
    "inputs.material.state": $("state").value,
    "inputs.equipment.leakAnchor": $("leak-anchor").value || null,
    "inputs.equipment.geometry.diameterM": num("diameterM"),
    "inputs.equipment.geometry.heightM": num("heightM"),
    "inputs.equipment.containment.lengthM": num("containment-length"),
    "inputs.equipment.containment.widthM": num("containment-width"),
    "inputs.pool.radiusM": num("pool-radius"),
    evidenceNotes: $("evidenceNotes").value,
    controls,
    assumptions,
  };
  for (const k of Object.keys(CONDITION_LABELS))
    patch[`inputs.scenario.conditions.${k}`] = $(`condition-${k}`).value;
  return {
    type: "batch",
    commands: [
      {
        type: "storage",
        patch: {
          quantityBasis: basis,
          quantityValue: quantity,
          temperatureK: kelvinFromC(num("temperature")),
          pressurePa: paFromKpa(num("pressure")),
          pressureMode: $("pressure-mode").value,
        },
      },
      { type: "patch", patch },
    ],
  };
}
function tick(now) {
  if (!playing || document.hidden) return;
  if (last)
    progress = Math.min(
      1,
      progress + ((now - last) / 22000) * project.ui.speed,
    );
  last = now;
  draw();
  if (progress >= 1) stop();
  else clock = requestAnimationFrame(tick);
}
function play() {
  playbackIntent++;
  if (!spec.support.canPlayDetailedStoryboard) return;
  if (playing) {
    stop();
    return;
  }
  if (progress >= 1) progress = 0;
  playing = true;
  last = 0;
  $("play").textContent = "暂停";
  updateMetrics();
  clock = requestAnimationFrame(tick);
}
function to2d({ cancelPlayback = true } = {}) {
  if (cancelPlayback) playbackIntent++;
  viewRequest++;
  viewMode = "2d";
  $("view-2d-host").hidden = false;
  $("view-3d-host").hidden = true;
  $("view-2d").setAttribute("aria-pressed", "true");
  $("view-3d").setAttribute("aria-pressed", "false");
  $("export-png").disabled = true;
  render2d($("view-2d-host"), spec, frame);
  $("view-status").textContent = spec.support.canPlayDetailedStoryboard
    ? "当前使用 2D 视图；教学功能与导出完整可用。"
    : "当前条件没有匹配的三维预设；记录保留，可查看兼容示例，不会自动更换物料或设备。";
}
async function to3d() {
  if (!spec.support.canPlayDetailedStoryboard) return;
  const generation = ++viewRequest;
  const sceneId = spec.sceneId;
  const requestedProject = project, revision = project.inputRevision;
  const isCurrent = () => generation === viewRequest && requestedProject === project &&
    revision === project.inputRevision && sceneId === spec.sceneId;
  $("view-status").textContent = "正在准备三维教学…";
  try {
    if (!view) {
      const mod = await import("./view-3d.mjs");
      if (!isCurrent()) return;
      $("view-3d-host").hidden = false;
      let createdView;
      createdView = mod.create3d($("view-3d-host"), (message) => {
        if (view !== createdView) return;
        createdView.dispose();
        view = null;
        to2d();
        $("view-status").textContent = message || "3D 不可用，已恢复 2D。";
      });
      view = createdView;
    }
    if (!isCurrent() || !spec.support.canPlayDetailedStoryboard)
      return;
    viewMode = "3d";
    project.ui.view = "3d";
    $("view-3d-host").hidden = false;
    $("view-2d-host").hidden = true;
    $("view-2d").setAttribute("aria-pressed", "false");
    $("view-3d").setAttribute("aria-pressed", "true");
    view.update(spec, frame);
    syncDisplayPreferences();
    view.setCamera(project.ui.camera);
    $("export-png").disabled = false;
    $("view-status").textContent =
      "拖动自由旋转，滚轮 / 双指缩放。三维体积为视觉模型，不能反推工程后果。";
    return { generation, mode: "3d" };
  } catch {
    // A cancelled/older import failure must not dispose a newer scene's view.
    if (!isCurrent()) return;
    view?.dispose();
    view = null;
    to2d({ cancelPlayback: false });
    $("view-status").textContent = "3D 不可用，当前使用完整 2D 视图。";
    return { generation: viewRequest, mode: "2d" };
  }
}
const options = (items, value) =>
  items
    .map(
      ([v, label]) =>
        `<option value="${escape(v)}"${v === value ? " selected" : ""}>${escape(label)}</option>`,
    )
    .join("");
function dialogCommand() {
  if (dialogType === "material") {
    const id = $("panel-material-select").value;
    if (id !== "custom-unknown") return { type: "material", id };
    return {
      type: "batch",
      commands: [
        { type: "material", id },
        {
          type: "patch",
          patch: {
            "inputs.material.name":
              $("panel-custom-name").value || "自定义物料",
            "inputs.material.english": $("panel-custom-english").value,
            "inputs.material.cas": $("panel-custom-cas").value || null,
            "inputs.material.composition": "unknown",
          },
        },
      ],
    };
  }
  if (dialogType === "equipment")
    return {
      type: "equipment",
      id: $("panel-equipment-select").value,
      leakAnchor: $("panel-leak-anchor").value || null,
    };
  if (dialogType === "scenario")
    return { type: "scenario", id: $("panel-scenario-select").value };
  if (dialogType === "preset")
    return { type: "preset", id: $("panel-preset-select").value };
  const basis = $("panel-basis").value;
  let quantity = num("panel-quantity");
  if (basis === "fill" && quantity !== null) quantity /= 100;
  return {
    type: "storage",
    patch: {
      quantityBasis: basis,
      quantityValue: quantity,
      temperatureK: kelvinFromC(num("panel-temperature")),
      pressurePa: paFromKpa(num("panel-pressure")),
      pressureMode: $("panel-pressure-mode").value,
    },
  };
}
function previewPanel() {
  try {
    pendingCommand = dialogCommand();
    const change = previewChange(project, pendingCommand, catalogs);
    $("change-summary").innerHTML =
      `<p><b>保留</b>：${escape(change.summary.kept.join("、"))}</p><p><b>更新</b>：${escape(change.summary.updated.join("、"))}</p>${change.summary.confirm.length ? `<p><b>需要确认</b></p><ul>${[...new Set(change.summary.confirm)].map((x) => `<li>${escape(x)}</li>`).join("")}</ul>` : "<p>工程量仍未评估；原结果将重新检查。</p>"}`;
    $("panel-errors").textContent = "";
    $("apply-change").disabled = false;
  } catch (e) {
    pendingCommand = null;
    $("panel-errors").textContent = e.message;
    $("apply-change").disabled = true;
  }
}
function setEquipmentAnchors() {
  const e = equipmentById(catalogs, $("panel-equipment-select").value),
    current = project.inputs.equipment.leakAnchor;
  $("panel-leak-anchor").innerHTML = options(
    [
      ["", "待选择"],
      ...e.leakAnchors.map((x) => [
        x,
        x === "valve-downstream" ? "根部阀后短管" : "罐壁（仅机制）",
      ]),
    ],
    e.leakAnchors.includes(current) ? current : "",
  );
}
function openPanel(type) {
  dialogType = type;
  const s = project.inputs.storage,
    m = project.inputs.material,
    e = project.inputs.equipment;
  const titles = {
    material: "只更换物料",
    equipment: "只更换储罐",
    storage: "修改库存与储存条件",
    scenario: "只切换事故类型",
    preset: "载入整套教学示例",
  };
  $("editor-title").textContent = titles[type];
  let html = "";
  if (type === "material")
    html = `<label>物料<select id="panel-material-select">${options(
      catalogs.chemicals.materials.map((m) => [
        m.id,
        `${m.name} / ${m.english || "通用教学"}`,
      ]),
      m.id,
    )}</select></label><div id="panel-custom-fields"${m.id === "custom-unknown" ? "" : " hidden"}><label>物料名称<input id="panel-custom-name" maxlength="200" value="${m.id === "custom-unknown" ? escape(m.name) : ""}"></label><label>英文名称（可留空）<input id="panel-custom-english" maxlength="200" value="${m.id === "custom-unknown" ? escape(m.english) : ""}"></label><label>CAS（可留空，未经身份核对）<input id="panel-custom-cas" maxlength="80" value="${m.id === "custom-unknown" ? escape(m.cas || "") : ""}"></label></div><p class="sc-muted">物料身份与教学外观会更新，原库存基准、设备和工况保留。自定义物料使用通用机制，不推断其燃烧外观或工程物性。</p>`;
  if (type === "equipment")
    html = `<label>储罐模板<select id="panel-equipment-select">${options(
      catalogs.equipment.equipment.map((x) => [x.id, x.name]),
      e.id,
    )}</select></label><label>泄漏位置<select id="panel-leak-anchor"></select></label><p class="sc-muted">容量与锚点重新核查；超容量不自动截断库存。</p>`;
  if (type === "scenario")
    html = `<label>事故类型<select id="panel-scenario-select">${options(
      catalogs.scenarios.scenarios.map((x) => [
        x.id,
        `${x.name} / ${x.english}`,
      ]),
      project.inputs.scenario.id,
    )}</select></label><p class="sc-muted">保留物料与温压。没有详细3D时，显示对应事故的独立机制。</p>`;
  if (type === "preset")
    html = `<label>完整示例<select id="panel-preset-select">${options(
      catalogs.presets.presets.map((x) => [x.presetId, x.title]),
      project.meta.presetId,
    )}</select></label><p class="sc-muted">替换整套条件，原草稿备份与冻结 A 保留；可恢复上一个草稿。</p>`;
  if (type === "storage") {
    const q = s[quantities[s.quantityBasis][0]],
      temp = m.temperatureK;
    html = `<label>库存主基准<select id="panel-basis">${options(
      [
        ["volume", "体积（m³）"],
        ["mass", "质量（kg）"],
        ["fill", "装填率（%）"],
      ],
      s.quantityBasis,
    )}</select></label><label>库存主输入<input id="panel-quantity" type="number" step="any" min="0" value="${q === null ? "" : s.quantityBasis === "fill" ? q * 100 : q}"></label><div class="sc-field-pair"><label>温度（°C）<input id="panel-temperature" type="number" step="any" value="${temp === null ? "" : Number((temp - 273.15).toFixed(6))}"></label><label>绝对压力（kPa）<input id="panel-pressure" type="number" step="any" min="0" value="${s.pressurePa === null ? "" : s.pressurePa / 1000}"></label></div><label>压力基准<select id="panel-pressure-mode">${options(
      [
        ["atmospheric", "常压教学示例"],
        ["absolute", "绝对压力"],
        ["unknown", "未填写"],
      ],
      s.pressureMode,
    )}</select></label>`;
  }
  $("panel-fields").innerHTML = html;
  if (type === "equipment") {
    setEquipmentAnchors();
    on("panel-equipment-select", "change", () => {
      setEquipmentAnchors();
      previewPanel();
    });
  }
  if (type === "material")
    on("panel-material-select", "change", () => {
      $("panel-custom-fields").hidden =
        $("panel-material-select").value !== "custom-unknown";
      previewPanel();
    });
  if (type === "storage") {
    on("panel-basis", "change", () => {
      $("panel-quantity").value = "";
      previewPanel();
    });
    on("panel-pressure-mode", "change", () => {
      if ($("panel-pressure-mode").value === "atmospheric")
        $("panel-pressure").value = "101.325";
      if ($("panel-pressure-mode").value === "unknown")
        $("panel-pressure").value = "";
      previewPanel();
    });
  }
  previewPanel();
  $("editor-dialog").showModal();
}
async function boot() {
  const base = new URL("./data/", import.meta.url),
    files = {
      chemicals: "chemicals",
      equipment: "equipment",
      presets: "presets",
      visualProfiles: "visual-profiles",
      scenarios: "scenarios",
      capabilities: "capabilities",
      registry: "model-registry",
      sources: "source-manifest",
    };
  catalogs = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, file]) => {
        const response = await fetch(new URL(file + ".json", base));
        if (!response.ok) throw Error("资料加载失败：" + file);
        return [key, await response.json()];
      }),
    ),
  );
  for (const key of [
    "chemicals",
    "equipment",
    "presets",
    "visualProfiles",
    "scenarios",
    "sources",
  ])
    if (catalogs[key].dataVersion !== DATA_VERSION)
      throw Error("资料版本不一致");
  if (
    catalogs.capabilities.appVersion !== APP_VERSION ||
    catalogs.capabilities.screeningEnabled !== false ||
    catalogs.capabilities.approvedChemicalIds.length
  )
    throw Error("公开能力配置不一致");
  project = createPreset(catalogs);
  let loaded;
  try {
    loaded = load(localStorage);
    legacyRaw = localStorage.getItem(LEGACY_KEY);
    originalV011Raw = localStorage.getItem(ORIGINAL_V011_KEY) || loaded.originalV011Raw || null;
    previousDraft = loadPrevious(localStorage);
  } catch (e) {
    loaded = { status: "failed", error: e.message };
  }
  draft = loaded.project;
  storageBlocked = loaded.status === "failed" || Boolean(loaded.writeBlocked);
  $("continue-draft").hidden = !draft;
  $("restore-previous").hidden = !previousDraft;
  $("legacy-json").hidden = !legacyRaw;
  $("original-v011-json").hidden = !originalV011Raw;
  if (loaded.writeBlocked) notice("旧版原始备份未能写入：保留内存与原草稿，暂停覆盖保存。请先下载 V0.1.1 原始备份和当前 JSON。");
  if (loaded.status === "failed")
    notice(
      "旧记录读取失败，原文已保留。示例仍可使用；请保留原始备份或导入有效项目。",
    );
  if (loaded.status === "unsaved")
    notice("旧记录已在内存迁移但未保存；旧键仍保留，请下载 JSON。");
  if (loaded.status === "migrated")
    notice("旧草稿已迁移至新版键，原始旧版数据完整保留。点击“继续我的草稿”。");
  $("conditions").innerHTML = Object.entries(CONDITION_LABELS)
    .map(
      ([k, label]) =>
        `<label>${escape(label)}<select id="condition-${k}"><option value="unknown">未确认</option><option value="yes">条件存在</option><option value="no">当前不满足</option></select></label>`,
    )
    .join("");
  $("control-fields").innerHTML = controlNames
    .map(
      (name, i) =>
        `<label class="sc-check"><input type="checkbox" id="control-${i}">${escape(name)} · 仅记录</label>`,
    )
    .join("");
  for (let i = 0; i < controlNames.length; i++)
    on(`control-${i}`, "change", controlOptions);
  on("control-record-select", "change", fillControlEditor);
  for (const id of ["boundary", "controlEvidence", "actionTimeS"])
    on(id, "input", () => {
      const type = $("control-record-select").value;
      if (type)
        controlEdits.set(type, {
          boundary: $("boundary").value,
          actionTimeS: num("actionTimeS"),
          evidence: $("controlEvidence").value,
        });
    });
  on("assumption", "input", () => {
    assumptionEdited = true;
  });
  worker = new Worker(SCENARIO_WORKER_URL, { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.result && acceptsResult(data.result, activeId, project)) {
      result = data.result;
      activeId = null;
      renderResult();
    } else if (data.error && data.calculationId === activeId) {
      activeId = null;
      renderResult();
      notice(data.error);
    }
  };
  worker.onerror = () => {
    activeId = null;
    renderResult();
    notice("检查进程不可用，仍可编辑并导出当前底稿。");
  };
  for (const type of ["material", "equipment", "storage", "scenario"])
    on("edit-" + type, "click", () => openPanel(type));
  on("load-preset", "click", () => openPanel("preset"));
  on("preset-gallery", "click", (e) => {
    const b = e.target.closest("[data-preset-id]");
    if (!b) return;
    openPanel("preset");
    $("panel-preset-select").value = b.dataset.presetId;
    previewPanel();
  });
  on("load-compatible", "click", () => {
    const preset = catalogs.presets.presets.find(p=>p.scenarioId===spec.sceneId);
    if (!preset) return;
    openPanel("preset");
    $("panel-preset-select").value = preset.presetId;
    previewPanel();
  });
  on("editor-form", "submit", (e) => e.preventDefault());
  on("panel-fields", "input", previewPanel);
  on("panel-fields", "change", previewPanel);
  on("cancel-change", "click", () => {
    $("editor-dialog").close();
    pendingCommand = null;
  });
  on("apply-change", "click", () => {
    if (!pendingCommand) return;
    $("apply-change").disabled = true;
    if (apply(pendingCommand)) {
      $("editor-dialog").close();
      pendingCommand = null;
    } else $("apply-change").disabled = false;
  });
  on("modify-scene", "click", () => {
    stop();
    ensureEditable();
    invalidate();
    render();
    persist();
    run();
    showConditions(true);
    $("quantity-value").focus();
    $("quantity-value").scrollIntoView({ block: "center" });
  });
  on("continue-draft", "click", () => {
    if (!draft) return;
    stop();
    project = clone(draft);
    mode = "draft";
    undo = null;
    progress = 0;
    invalidate();
    render();
    run();
    persist();
  });
  on("play-example", "click", async () => {
    $("view-panel").scrollIntoView({ block: "start", behavior: "instant" });
    if (spec.support.canPlayDetailedStoryboard) {
      if (playing) return;
      const intent = ++playbackIntent, requestedProject = project,
        revision = project.inputRevision;
      const prepared = await to3d();
      // Keep the 22-second teaching clock stopped during import/first render.
      // A later user action, scene replacement or view switch cancels this start.
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (prepared && intent === playbackIntent && requestedProject === project &&
          revision === project.inputRevision && prepared.generation === viewRequest &&
          !document.hidden && !playing) play();
    } else notice("当前条件没有匹配的三维预设。可载入对应事故的完整兼容示例；不会暗改你的条件。");
  });
  on("common-form", "submit", (e) => e.preventDefault());
  on("quantity-basis", "change", () => {
    $("quantity-value").value = "";
    $("quantity-label").textContent =
      `库存（${quantities[$("quantity-basis").value][1]}）`;
  });
  on("pressure-mode", "change", () => {
    if ($("pressure-mode").value === "atmospheric")
      $("pressure").value = "101.325";
    if ($("pressure-mode").value === "unknown") $("pressure").value = "";
  });
  on("apply-common", "click", () => {
    try {
      const command = commonCommand();
      previewChange(project, command, catalogs);
      $("common-error").textContent = "";
      apply(command);
    } catch (e) {
      $("common-error").textContent = e.message;
    }
  });
  on("undo", "click", () => {
    if (!undo) return;
    stop();
    project = undoLastChange(project, undo);
    undo = null;
    progress = 0;
    invalidate();
    render();
    persist();
    run();
    notice("上次输入已恢复；原异步任务不会覆盖当前输入。");
  });
  on("restore-previous", "click", () => {
    if (!previousDraft) return;
    const old = clone(previousDraft),
      current = mode === "draft" ? project : draft;
    if (current && !backup(current)) return;
    stop();
    ensureEditable();
    old.inputRevision = project.inputRevision + 1;
    undo = clone(project);
    project = old;
    mode = "draft";
    progress = 0;
    invalidate();
    render();
    persist();
    run();
    notice("上一个草稿已恢复。");
  });
  on("play", "click", play);
  on("replay", "click", () => {
    stop();
    progress = 0;
    draw();
    play();
  });
  on("timeline", "input", () => {
    stop();
    progress = Number($("timeline").value);
    draw();
  });
  on("stages", "click", (e) => {
    const b = e.target.closest("[data-stage]");
    if (!b) return;
    stop();
    progress = (Number(b.dataset.stage) + 0.2) / spec.stages.length;
    draw();
  });
  on("view-2d", "click", () => {
    project.ui.view = "2d";
    to2d();
  });
  on("view-3d", "click", to3d);
  on("toggle-conditions", "click", () => showConditions($("conditions-sidebar").hidden));
  on("fullscreen", "click", async () => {
    const panel = $("view-panel");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (panel.classList.contains("sc-fullscreen-fallback")) panel.classList.remove("sc-fullscreen-fallback");
      else if (panel.requestFullscreen) await panel.requestFullscreen();
      else panel.classList.add("sc-fullscreen-fallback");
    } catch {
      panel.classList.toggle("sc-fullscreen-fallback");
      notice("当前浏览器未开放系统全屏，使用页面内全屏。按 Escape 退出。");
    }
    const active = Boolean(document.fullscreenElement || panel.classList.contains("sc-fullscreen-fallback"));
    $("fullscreen").setAttribute("aria-pressed", String(active));
    $("fullscreen").textContent = active ? "退出全屏" : "全屏观看";
  });
  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement);
    $("fullscreen").setAttribute("aria-pressed", String(active));
    $("fullscreen").textContent = active ? "退出全屏" : "全屏观看";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("view-panel").classList.remove("sc-fullscreen-fallback");
      if (!document.fullscreenElement) {
        $("fullscreen").setAttribute("aria-pressed", "false");
        $("fullscreen").textContent = "全屏观看";
      }
    }
  });
  for (const [id, key] of [["quality", "quality"], ["cutaway", "cutaway"], ["pressure-aux", "pressureAux"], ["label-detail", "labelDetail"]]) {
    on(id, "change", () => {
      project.ui[key] = id === "quality" ? $(id).value : $(id).checked;
      syncDisplayPreferences();
      persist();
    });
  }
  on("export-png", "click", async () => {
    if (exportingFrame || !view || viewMode !== "3d") return;
    stop();
    const generation = frameExportGeneration, revision = project.inputRevision;
    const [width, height] = $("png-size").value.split("x").map(Number);
    exportingFrame = true;
    lastFrameMetadata = null;
    $("export-frame-meta").disabled = true;
    $("export-png").disabled = true;
    $("frame-export-status").textContent = `正在以 ${width} × ${height} 重新渲染当前镜头…`;
    try {
      const output = await view.exportFrame({width, height, labels: project.ui.labels});
      if (generation !== frameExportGeneration || revision !== project.inputRevision) throw Error("场景已改变，未下载旧画面，请按当前场景重新导出");
      if (!(output?.blob instanceof Blob)) throw Error("没有获得有效 3D 图像");
      download(output.blob, "image/png", "png");
      lastFrameMetadata = {...output.metadata, inputRevision: revision, projectId: project.meta.id, exportedAt: new Date().toISOString()};
      $("export-frame-meta").disabled = false;
      $("frame-export-status").textContent = `已导出 ${width} × ${height} 当前 3D 画面。镜头与阶段已冻结，元数据可单独下载；交互已恢复。`;
    } catch (e) {
      $("frame-export-status").textContent = "画面导出未完成：" + e.message;
    } finally {
      exportingFrame = false;
      $("export-png").disabled = viewMode !== "3d" || !view;
    }
  });
  on("export-frame-meta", "click", () => {
    if (lastFrameMetadata) download(JSON.stringify(lastFrameMetadata, null, 2), "application/json", "frame.json");
  });
  on("camera-select", "change", () => {
    project.ui.camera = $("camera-select").value;
    view?.setCamera(project.ui.camera);
    persist();
  });
  on("visual-mode", "change", () => {
    project.ui.visualMode = $("visual-mode").value;
    spec = buildSceneSpec(project, catalogs);
    $("visual-note").textContent = spec.visual.note;
    draw();
    persist();
  });
  on("show-labels", "change", () => {
    project.ui.labels = $("show-labels").checked;
    view?.setLabelsVisible(project.ui.labels);
    persist();
  });
  on("speed", "change", () => {
    project.ui.speed = Number($("speed").value);
    persist();
  });
  on("check", "click", run);
  on("freeze", "click", () => {
    try {
      project.comparison = freezeA(project, result);
      persist();
      renderComparison();
      notice("方案 A 已独立冻结；后续修改只影响 B。");
    } catch (e) {
      notice(e.message);
    }
  });
  on("open-output", "click", () => {
    $("comparison-output").open = true;
  });
  on("json", "click", () =>
    download(JSON.stringify(project, null, 2), "application/json", "json"),
  );
  on("legacy-json", "click", () => {
    if (legacyRaw) download(legacyRaw, "application/json", "v1.json");
  });
  on("original-v011-json", "click", () => {
    if (originalV011Raw) download(originalV011Raw, "application/json", "v0.1.1-original.json");
  });
  on("csv", "click", () =>
    download(csv(project, result, catalogs), "text/csv;charset=utf-8", "csv"),
  );
  on("print", "click", () => {
    $("print-report").innerHTML = report(project, result, catalogs, frame);
    $("print-report").hidden = false;
    window.print();
  });
  on("import", "click", () => $("import-file").click());
  on("import-file", "change", async () => {
    const generation = ++importGeneration,
      file = $("import-file").files[0];
    if (!file) return;
    try {
      if (file.size > 1048576) throw Error("文件超过 1 MiB");
      const p = parseProjectText(await file.text());
      if (generation !== importGeneration) return;
      importCandidate = p;
      $("import-summary").textContent =
        `有效备份：${p.inputs.material.name} / ${p.inputs.scenario.id}。恢复将替换新版草稿，旧版键保留；结果需重新检查。`;
      $("import-preview").hidden = false;
    } catch (e) {
      if (generation !== importGeneration) return;
      importCandidate = null;
      notice("导入失败：" + e.message + "。当前记录保持不变。");
    }
    $("import-file").value = "";
  });
  on("cancel-import", "click", () => {
    importGeneration++;
    importCandidate = null;
    $("import-preview").hidden = true;
  });
  on("restore", "click", () => {
    if (!importCandidate) return;
    if (
      (mode === "draft" || draft) &&
      !backup(mode === "draft" ? project : draft)
    )
      return;
    stop();
    const rev = project.inputRevision;
    project = importCandidate;
    project.inputRevision = Math.max(project.inputRevision, rev) + 1;
    importCandidate = null;
    storageBlocked = false;
    mode = "draft";
    progress = 0;
    undo = null;
    invalidate();
    $("import-preview").hidden = true;
    render();
    persist();
    notice("备份已恢复。当前结果待检查，未继承任何审核声明。");
  });
  on("clear", "click", () => {
    if (
      !confirm(
        "清除本工具新版草稿及上一草稿备份？旧 v1、V0.1.1 原始备份与其他工具数据保留；可先导出当前 JSON。",
      )
    )
      return;
    try {
      clear(localStorage);
      draft = null;
      previousDraft = null;
      $("continue-draft").hidden = true;
      $("restore-previous").hidden = true;
      notice("新版草稿已清除。旧 v1 与 V0.1.1 原始备份保留，但不会自动复活为当前草稿。");
      if (mode === "draft") {
        stop();
        project = createPreset(catalogs);
        mode = "example";
        progress = 0;
        undo = null;
        invalidate();
        render();
        run();
      }
    } catch (e) {
      notice("清除失败：" + e.message);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", () => {
    stop();
    viewRequest++;
    view?.dispose();
    worker.terminate();
  });
  $("boot-status").hidden = true;
  $("workspace").hidden = false;
  render();
  persist();
  run();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) void to3d();
}
boot().catch((e) => {
  $("boot-status").textContent =
    "工作台加载失败：" + e.message + "。请刷新或查看下方范围说明。";
});

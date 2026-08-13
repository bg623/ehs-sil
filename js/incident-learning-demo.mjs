import { STORAGE_KEY, WORKFLOW_STEPS, DEMO_CASES, initialState, getCase, progress, closureGate, completeStep, buildSafetyAlertHtml } from "./incident-learning-demo-model.mjs";

const caseList = document.querySelector("[data-demo-cases]");
const workspace = document.querySelector("[data-demo-workspace]");
const notice = document.querySelector("[data-demo-notice]");
let state = load();

function load() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return stored?.version === 1 ? stored : initialState();
  } catch { return initialState(); }
}

function save() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }

function renderCases() {
  caseList.innerHTML = DEMO_CASES.map((item) => `<button class="demo-case ${item.id === state.caseId ? "is-active" : ""}" type="button" data-case-id="${item.id}"><span>${item.code}</span><strong>${item.title}</strong><small>${item.classification}</small></button>`).join("");
}

function stepDetail(step, demoCase) {
  const details = {
    report: demoCase.summary,
    triage: demoCase.classification,
    assignment: demoCase.investigatorRole,
    timeline: `<ol>${demoCase.timeline.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`,
    causes: `<p><strong>直接原因：</strong>${escapeHtml(demoCase.directCause)}</p><p><strong>根本原因：</strong>${escapeHtml(demoCase.rootCause)}</p>`,
    barriers: `<ul>${demoCase.barriers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><p>确认后视为“调查已批准”（仅演示）。</p>`,
    actions: `<ul>${demoCase.actions.map((item) => `<li>${escapeHtml(item.text)}｜${escapeHtml(item.owner)}｜${item.due}</li>`).join("")}</ul>`,
    evidence: "模拟证据：预置检查记录、功能测试结果和完成标记；不上传文件。",
    verification: "预置验证结论：强制措施均已按虚构验收条件验证。",
    lfi: `预置关键教训：${demoCase.lesson}`,
    rollout: `模拟推广范围：${demoCase.rollout}`,
    closure: "系统将同时检查调查批准、强制整改验证和LFI发布状态。",
  };
  return details[step.id];
}

function render() {
  const demoCase = getCase(state.caseId);
  const meter = progress(state);
  const expected = WORKFLOW_STEPS[state.completed.length]?.id;
  renderCases();
  workspace.innerHTML = `
    <section class="demo-summary" aria-labelledby="demo-case-title">
      <div><p class="demo-kicker">当前纯虚构案例 · ${demoCase.code}</p><h2 id="demo-case-title">${demoCase.title}</h2><p>${demoCase.summary}</p></div>
      <div class="demo-progress-copy"><strong>${meter.percent}%</strong><span>已完成 ${meter.completed}/${meter.total} · 剩余 ${meter.remaining} 步</span></div>
      <div class="demo-progress-track" aria-label="演示进度 ${meter.percent}%"><span style="width:${meter.percent}%"></span></div>
    </section>
    <ol class="demo-workflow">
      ${WORKFLOW_STEPS.map((step, index) => {
        const done = state.completed.includes(step.id);
        const active = expected === step.id;
        return `<li class="demo-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}">
          <div class="demo-step-number">${String(index + 1).padStart(2, "0")}</div>
          <div class="demo-step-body"><h3>${step.title}</h3><div class="demo-step-detail">${stepDetail(step, demoCase)}</div>
          <p class="demo-step-status">${done ? "✓ 已完成" : active ? "当前步骤" : "等待前序步骤"}</p></div>
          <button type="button" class="ds-btn ${active ? "ds-btn-accent" : "ds-btn-secondary"}" data-complete-step="${step.id}" ${done || !active ? "disabled" : ""}>${step.id === "closure" ? "检查并关闭" : "确认并继续"}</button>
        </li>`;
      }).join("")}
    </ol>
    <section class="demo-output" aria-label="演示输出">
      <div><p class="demo-kicker">Executive-ready output · 展示级成果</p><h2>LFI / Safety Alert</h2><p>跨国公司展示级单页版式，只使用预置虚构内容，不包含用户输入或真实身份信息。</p></div>
      <div class="demo-output-actions"><button type="button" class="ds-btn ds-btn-secondary" data-download-alert>下载展示版HTML</button><button type="button" class="ds-btn ds-btn-accent" data-print-alert>打印 / 存为PDF</button></div>
      <div class="alert-stage">${buildSafetyAlertHtml(demoCase, state)}</div>
    </section>
    <section class="demo-validation" aria-label="产品验证反馈">
      <div><p class="demo-kicker">Product validation · 产品验证</p><h2>完成后，请做3个固定选择</h2><p>不需要姓名、联系方式或自由文本；选择只保存在当前浏览器会话。</p></div>
      ${feedbackQuestion("clarity", "这条闭环是否容易理解？", ["很清楚", "基本清楚", "仍有困惑"])}
      ${feedbackQuestion("value", "哪个环节最有价值？", ["屏障分析", "整改验证", "LFI与推广"])}
      ${feedbackQuestion("intent", "你愿意把它用于实际工作吗？", ["愿意试用", "需要更简化", "暂不需要"])}
      <p class="demo-feedback-status">${Object.keys(state.feedback ?? {}).length}/3 已选择 · 仅用于本次会话内验证</p>
    </section>`;
}

function feedbackQuestion(id, title, options) {
  const selected = state.feedback?.[id];
  return `<fieldset class="demo-feedback-group"><legend>${title}</legend><div>${options.map((option) => `<button type="button" class="demo-choice ${selected === option ? "is-selected" : ""}" data-feedback-id="${id}" data-feedback-value="${option}">${option}</button>`).join("")}</div></fieldset>`;
}

function flash(message, tone = "info") { notice.textContent = message; notice.dataset.tone = tone; }

document.addEventListener("click", (event) => {
  const caseButton = event.target.closest("[data-case-id]");
  if (caseButton) { state = initialState(caseButton.dataset.caseId); save(); flash("已切换案例并重置进度"); render(); return; }
  const stepButton = event.target.closest("[data-complete-step]");
  if (stepButton) { const result = completeStep(state, stepButton.dataset.completeStep); state = result.state; if (result.ok) save(); flash(result.message, result.ok ? "success" : "warning"); render(); return; }
  if (event.target.closest("[data-reset-demo]")) { sessionStorage.removeItem(STORAGE_KEY); state = initialState(state.caseId); flash("演示状态已从本次浏览器会话清空", "success"); render(); return; }
  const feedbackButton = event.target.closest("[data-feedback-id]");
  if (feedbackButton) { state = { ...state, feedback: { ...(state.feedback ?? {}), [feedbackButton.dataset.feedbackId]: feedbackButton.dataset.feedbackValue } }; save(); flash("选择已保存在当前浏览器会话", "success"); render(); return; }
  if (event.target.closest("[data-download-alert]")) {
    const styles = [...document.styleSheets].map((sheet) => {
      try { return [...sheet.cssRules].map((rule) => rule.cssText).join("\n"); }
      catch { return ""; }
    }).join("\n");
    const report = buildSafetyAlertHtml(getCase(state.caseId), state);
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${styles}</style><title>${getCase(state.caseId).code} Safety Alert</title></head><body class="downloaded-alert">${report}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = `${getCase(state.caseId).code}-Safety-Alert-展示版-纯虚构.html`; anchor.click(); URL.revokeObjectURL(anchor.href); flash("展示版Safety Alert已下载", "success"); return;
  }
  if (event.target.closest("[data-print-alert]")) window.print();
});

window.addEventListener("beforeprint", () => document.body.dataset.printGate = closureGate(state).allowed ? "complete" : "incomplete");
render();

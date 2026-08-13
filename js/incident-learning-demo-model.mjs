export const STORAGE_KEY = "ehs-sil:lfi-demo:v0.1";

export const WORKFLOW_STEPS = [
  { id: "report", title: "快速报告" },
  { id: "triage", title: "事件分级" },
  { id: "assignment", title: "调查任务分配" },
  { id: "timeline", title: "时间线" },
  { id: "causes", title: "直接原因与根本原因" },
  { id: "barriers", title: "屏障失效分析与调查批准" },
  { id: "actions", title: "整改措施、责任角色和期限" },
  { id: "evidence", title: "完成证据模拟" },
  { id: "verification", title: "整改有效性验证" },
  { id: "lfi", title: "LFI / Safety Alert生成与发布" },
  { id: "rollout", title: "经验推广确认" },
  { id: "closure", title: "事故关闭" },
];

export const DEMO_CASES = [
  {
    id: "chemical-splash-near-miss",
    title: "化学品飞溅未遂事件",
    code: "DEMO-CHEM-001",
    summary: "虚构灌装区拆卸软管时，少量清洗液飞溅到空置隔离区，无人员接触。",
    classification: "未遂事件 · 潜在后果较高",
    investigatorRole: "EHS调查员（虚构角色）",
    timeline: ["09:00 虚构班前确认", "10:12 停泵后拆卸软管", "10:13 发现残余压力并停止作业", "10:20 隔离区域复核"],
    directCause: "软管内存在未释放的残余压力。",
    rootCause: "停泵与泄压确认没有形成独立验证屏障。",
    barriers: ["零压力确认：缺失", "软管拆卸前二次确认：失效", "面部防护：存在但未作为首要控制"],
    actions: [
      { id: "A1", text: "增加可视化零压力确认点", owner: "设备工程角色", due: "7天", mandatory: true },
      { id: "A2", text: "修订拆卸前双人确认卡", owner: "区域主管角色", due: "14天", mandatory: true },
    ],
    lesson: "停泵不等于零能量；断开含化学品管线前必须确认隔离、泄压和残余物料。",
    rollout: "同类灌装与清洗接口（虚构范围）",
  },
  {
    id: "contractor-height-near-miss",
    title: "承包商高处坠落险情",
    code: "DEMO-WAH-002",
    summary: "虚构承包商在两米平台调整临时护栏时失去平衡，被已连接的防坠系统制止。",
    classification: "高潜未遂事件",
    investigatorRole: "承包商管理调查员（虚构角色）",
    timeline: ["13:30 虚构作业许可确认", "14:05 调整临时护栏", "14:06 人员失衡并触发防坠系统", "14:08 作业停止"],
    directCause: "调整护栏时作业姿势超出稳定支撑范围。",
    rootCause: "临时护栏调整任务未纳入许可和JSA的变更检查。",
    barriers: ["防坠系统：有效", "临时护栏变更审批：缺失", "下方隔离：存在"],
    actions: [
      { id: "A1", text: "将临时防护变更纳入重新许可", owner: "作业许可签发角色", due: "7天", mandatory: true },
      { id: "A2", text: "增加锚点与救援条件现场复核", owner: "承包商主管角色", due: "10天", mandatory: true },
    ],
    lesson: "高处作业条件变化必须触发停工和重新评估，防坠装备不能替代稳定作业面。",
    rollout: "全部虚构承包商高处作业点",
  },
  {
    id: "machine-guard-failure",
    title: "设备防护装置失效事件",
    code: "DEMO-GUARD-003",
    summary: "虚构包装设备联锁护门打开后设备未立即停止，操作人员按下急停，无人员受伤。",
    classification: "设备安全功能失效 · 高潜事件",
    investigatorRole: "设备安全调查员（虚构角色）",
    timeline: ["08:15 虚构开机检查", "09:42 打开联锁护门", "09:42 设备继续运行", "09:43 急停并隔离设备"],
    directCause: "联锁开关位置偏移，未触发停止信号。",
    rootCause: "维护后的安全功能验证清单未覆盖实际触发距离。",
    barriers: ["联锁停止：失效", "急停：有效", "维护后功能测试：不完整"],
    actions: [
      { id: "A1", text: "增加联锁实际触发距离测试", owner: "维修工程角色", due: "3天", mandatory: true },
      { id: "A2", text: "抽查同型号设备安全功能", owner: "设备安全角色", due: "14天", mandatory: true },
    ],
    lesson: "安全装置维护后必须验证实际安全功能，而不仅是电气信号或静态状态。",
    rollout: "同型号虚构包装设备",
  },
];

export function initialState(caseId = DEMO_CASES[0].id) {
  return { version: 1, caseId, completed: [], investigationApproved: false, actionsVerified: false, lfiPublished: false, closed: false, feedback: {} };
}

export function getCase(caseId) {
  return DEMO_CASES.find((item) => item.id === caseId) ?? DEMO_CASES[0];
}

export function progress(state) {
  const count = state.completed.length;
  return { completed: count, total: WORKFLOW_STEPS.length, remaining: WORKFLOW_STEPS.length - count, percent: Math.round((count / WORKFLOW_STEPS.length) * 100) };
}

export function closureGate(state) {
  const missing = [];
  if (!state.investigationApproved) missing.push("调查尚未批准");
  if (!state.actionsVerified) missing.push("强制整改措施尚未全部验证");
  if (!state.lfiPublished) missing.push("必需的LFI尚未发布");
  return { allowed: missing.length === 0, missing };
}

export function completeStep(state, stepId) {
  const index = WORKFLOW_STEPS.findIndex((step) => step.id === stepId);
  if (index < 0) return { state, ok: false, message: "未知步骤" };
  const expected = WORKFLOW_STEPS[state.completed.length]?.id;
  if (stepId !== expected) return { state, ok: false, message: `请先完成“${WORKFLOW_STEPS[state.completed.length]?.title ?? "前序步骤"}”` };
  if (stepId === "closure") {
    const gate = closureGate(state);
    if (!gate.allowed) return { state, ok: false, message: gate.missing.join("；") };
  }
  const next = { ...state, completed: [...state.completed, stepId] };
  if (stepId === "barriers") next.investigationApproved = true;
  if (stepId === "verification") next.actionsVerified = true;
  if (stepId === "lfi") next.lfiPublished = true;
  if (stepId === "closure") next.closed = true;
  return { state: next, ok: true, message: stepId === "closure" ? "虚构案例已完成闭环" : "本步已完成" };
}

export function buildSafetyAlert(demoCase, state) {
  const gate = closureGate(state);
  return [
    "EHS-SIL LFI / Safety Alert（纯虚构演示）",
    `案例编号：${demoCase.code}`,
    `案例名称：${demoCase.title}`,
    "声明：本文件仅含预置虚构内容，不对应任何真实企业、人员或事故。",
    "",
    `事件概要：${demoCase.summary}`,
    `分级：${demoCase.classification}`,
    `直接原因：${demoCase.directCause}`,
    `根本原因：${demoCase.rootCause}`,
    `关键教训：${demoCase.lesson}`,
    "整改措施：",
    ...demoCase.actions.map((action) => `- ${action.text}｜责任：${action.owner}｜期限：${action.due}｜状态：${state.actionsVerified ? "模拟验证完成" : "待模拟验证"}`),
    `经验推广：${demoCase.rollout}`,
    `调查批准：${state.investigationApproved ? "是" : "否"}`,
    `LFI发布：${state.lfiPublished ? "是" : "否"}`,
    `关闭条件：${gate.allowed ? "已满足" : gate.missing.join("；")}`,
  ].join("\n");
}

export function alertStatus(state) {
  if (state.closed) return { label: "CLOSED · 已关闭", tone: "closed" };
  if (state.lfiPublished) return { label: "PUBLISHED · 已发布", tone: "published" };
  return { label: "DRAFT · 演示草稿", tone: "draft" };
}

export function buildSafetyAlertHtml(demoCase, state) {
  const status = alertStatus(state);
  const gate = closureGate(state);
  const barrierRows = demoCase.barriers.map((barrier, index) => {
    const tone = /有效|存在/.test(barrier) && !/失效|缺失|不完整/.test(barrier) ? "effective" : "gap";
    return `<li class="alert-barrier alert-barrier-${tone}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${barrier}</strong></li>`;
  }).join("");
  const actionRows = demoCase.actions.map((action) => `<tr><td>${action.id}</td><td>${action.text}</td><td>${action.owner}</td><td>${action.due}</td><td><span class="alert-pill ${state.actionsVerified ? "is-verified" : ""}">${state.actionsVerified ? "已模拟验证" : "待验证"}</span></td></tr>`).join("");
  return `<article class="safety-alert-sheet" data-safety-alert-sheet>
    <header class="alert-cover">
      <div class="alert-brand"><span class="alert-mark">EHS</span><div><strong>EHS-SIL</strong><small>Learning From Incident · 从事故中学习</small></div></div>
      <div class="alert-document"><span>SAFETY ALERT</span><strong>${demoCase.code}</strong></div>
      <div class="alert-cover-copy"><p class="alert-overline">PURELY FICTIONAL DEMONSTRATION · 纯虚构演示</p><h2>${demoCase.title}</h2><p>${demoCase.summary}</p></div>
      <div class="alert-cover-meta"><span class="alert-status alert-status-${status.tone}">${status.label}</span><span>${demoCase.classification}</span><span>发布日期：演示完成时</span></div>
    </header>
    <section class="alert-key-message"><span>KEY LEARNING<br>关键教训</span><p>${demoCase.lesson}</p></section>
    <section class="alert-two-column">
      <div class="alert-panel"><p class="alert-section-no">01</p><h3>发生了什么<br><small>What happened</small></h3><ol class="alert-timeline">${demoCase.timeline.map((item) => `<li>${item}</li>`).join("")}</ol></div>
      <div class="alert-panel"><p class="alert-section-no">02</p><h3>为什么发生<br><small>Why it happened</small></h3><div class="alert-cause"><span>直接原因</span><p>${demoCase.directCause}</p></div><div class="alert-cause alert-cause-root"><span>根本原因</span><p>${demoCase.rootCause}</p></div></div>
    </section>
    <section class="alert-panel alert-barriers"><p class="alert-section-no">03</p><h3>关键屏障状态 <small>Critical barrier status</small></h3><ul>${barrierRows}</ul></section>
    <section class="alert-panel alert-actions"><p class="alert-section-no">04</p><h3>关键行动与验证 <small>Actions &amp; verification</small></h3><div class="alert-table-wrap"><table><thead><tr><th>ID</th><th>行动</th><th>责任角色</th><th>期限</th><th>验证状态</th></tr></thead><tbody>${actionRows}</tbody></table></div></section>
    <section class="alert-rollout"><div><span>SHARE &amp; APPLY · 分享与应用</span><h3>经验推广范围</h3><p>${demoCase.rollout}</p></div><div class="alert-gate"><strong>${gate.allowed ? "闭环条件已满足" : "闭环条件待完成"}</strong><span>调查批准 ${state.investigationApproved ? "✓" : "○"}</span><span>措施验证 ${state.actionsVerified ? "✓" : "○"}</span><span>LFI发布 ${state.lfiPublished ? "✓" : "○"}</span></div></section>
    <footer class="alert-footer"><span>EHS-SIL · 外企EHS工具与成长工作台</span><strong>仅供产品演示，不对应任何真实企业、人员或事故</strong><span>PAGE 01 / 01</span></footer>
  </article>`;
}

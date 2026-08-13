import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DEMO_CASES, WORKFLOW_STEPS, STORAGE_KEY, initialState, completeStep, closureGate, buildSafetyAlert, buildSafetyAlertHtml, alertStatus } from "../js/incident-learning-demo-model.mjs";

const page = fs.readFileSync(new URL("../tools/incident-learning-demo.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/incident-learning-demo.mjs", import.meta.url), "utf8");
const model = fs.readFileSync(new URL("../js/incident-learning-demo-model.mjs", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../css/incident-learning-demo.css", import.meta.url), "utf8");
const entry = fs.readFileSync(new URL("../tools/incident-learning.html", import.meta.url), "utf8");

function complete(caseId) {
  let state = initialState(caseId);
  for (const step of WORKFLOW_STEPS) {
    const result = completeStep(state, step.id);
    assert.equal(result.ok, true, `${caseId}无法完成${step.id}`);
    state = result.state;
  }
  return state;
}

test("3个纯虚构案例均可完成12步闭环", () => {
  assert.equal(DEMO_CASES.length, 3);
  assert.deepEqual(DEMO_CASES.map((item) => item.title), ["化学品飞溅未遂事件", "承包商高处坠落险情", "设备防护装置失效事件"]);
  for (const demoCase of DEMO_CASES) {
    const state = complete(demoCase.id);
    assert.equal(state.closed, true);
    assert.equal(state.completed.length, 12);
  }
});

test("调查未批准时业务模型阻止关闭", () => {
  const state = { ...initialState(), completed: WORKFLOW_STEPS.slice(0, -1).map((step) => step.id), investigationApproved: false, actionsVerified: true, lfiPublished: true };
  const result = completeStep(state, "closure");
  assert.equal(result.ok, false); assert.match(result.message, /调查尚未批准/); assert.equal(result.state.closed, false);
});

test("强制整改未验证时业务模型阻止关闭", () => {
  const state = { ...initialState(), completed: WORKFLOW_STEPS.slice(0, -1).map((step) => step.id), investigationApproved: true, actionsVerified: false, lfiPublished: true };
  assert.equal(closureGate(state).allowed, false);
  assert.match(completeStep(state, "closure").message, /强制整改措施尚未全部验证/);
});

test("必需LFI未发布时业务模型阻止关闭", () => {
  const state = { ...initialState(), completed: WORKFLOW_STEPS.slice(0, -1).map((step) => step.id), investigationApproved: true, actionsVerified: true, lfiPublished: false };
  assert.equal(closureGate(state).allowed, false);
  assert.match(completeStep(state, "closure").message, /必需的LFI尚未发布/);
});

test("演示页面无自由文本、表单和文件上传入口", () => {
  assert.doesNotMatch(page, /<form\b|<input\b|<textarea\b|contenteditable|type=["']file["']/i);
  assert.match(page, /演示环境，请勿输入真实事故或个人信息/);
  assert.match(entry, /incident-learning-demo\.html/);
});

test("演示代码不存在外部数据提交请求或Sandbox API连接", () => {
  const combined = `${page}\n${app}\n${model}`;
  assert.doesNotMatch(combined, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\/sandbox\//);
  assert.doesNotMatch(page, /action\s*=/i);
});

test("重置操作清空sessionStorage键", () => {
  assert.equal(STORAGE_KEY, "ehs-sil:lfi-demo:v0.1");
  assert.match(app, /sessionStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(page, /data-reset-demo/);
});

test("LFI打印和下载输出只含虚构角色，不含真实身份字段", () => {
  for (const demoCase of DEMO_CASES) {
    const output = buildSafetyAlert(demoCase, complete(demoCase.id));
    const html = buildSafetyAlertHtml(demoCase, complete(demoCase.id));
    assert.match(output, /纯虚构演示/);
    assert.match(html, /SAFETY ALERT/);
    assert.match(html, /KEY LEARNING/);
    assert.match(html, /PAGE 01 \/ 01/);
    assert.doesNotMatch(output, /姓名|手机号|身份证|员工编号|电子邮箱|患者|诊断|病史/);
    assert.doesNotMatch(html, /姓名|手机号|身份证|员工编号|电子邮箱|患者|诊断|病史/);
  }
  assert.match(css, /@media print/);
  assert.match(css, /size:\s*A4 portrait/);
});

test("Safety Alert状态随闭环阶段准确变化", () => {
  const draft = initialState();
  const published = { ...draft, lfiPublished: true };
  const closed = { ...published, closed: true };
  assert.deepEqual(alertStatus(draft), { label: "DRAFT · 演示草稿", tone: "draft" });
  assert.deepEqual(alertStatus(published), { label: "PUBLISHED · 已发布", tone: "published" });
  assert.deepEqual(alertStatus(closed), { label: "CLOSED · 已关闭", tone: "closed" });
});

test("产品验证只提供固定选择并仅存于sessionStorage", () => {
  assert.match(app, /feedbackQuestion\("clarity"/);
  assert.match(app, /feedbackQuestion\("value"/);
  assert.match(app, /feedbackQuestion\("intent"/);
  assert.match(app, /data-feedback-id/);
  assert.match(app, /sessionStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(app, /localStorage|<textarea|contenteditable|type=["']file/);
});

test("下载的展示版为自包含HTML且不引用远程样式", () => {
  assert.match(app, /document\.styleSheets/);
  assert.match(app, /sheet\.cssRules/);
  assert.match(app, /<style>\$\{styles\}<\/style>/);
  assert.match(app, /Safety-Alert-展示版-纯虚构\.html/);
  assert.doesNotMatch(app, /<link rel=\\?"stylesheet\\?" href=/);
});

test("展示区按钮在深色背景下具有明确可见状态", () => {
  assert.match(css, /\.demo-output-actions \.ds-btn-secondary\s*\{\s*background:\s*transparent/);
  assert.match(css, /\.demo-output-actions \.ds-btn-accent[^}]*background:\s*#8a590c/);
  assert.match(css, /\.demo-output-actions \.ds-btn:hover[^}]*background:\s*#fff[^}]*color:\s*#082f2a/);
});

test("桌面端和390px移动端布局明确防止横向溢出", () => {
  assert.match(page, /name="viewport"/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(css, /minmax\(0, 1fr\)/);
  const mobileBlock = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.doesNotMatch(mobileBlock, /min-width:\s*[2-9][0-9]{2}px/);
});

console.log(JSON.stringify({ status: "PASS", cases: DEMO_CASES.length, steps: WORKFLOW_STEPS.length, closure_gates: 3, external_requests: 0, real_data_fields: 0 }));

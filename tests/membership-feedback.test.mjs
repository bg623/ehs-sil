import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const authCode = read("js/auth.js");
const membershipUiCode = read("js/membership-ui.js");
const feedbackCode = read("js/feedback.js");
const adminCode = read("js/feedback-admin.js");
const home = read("index.html");
const training = read("js/training-matrix-app.mjs");
const compliance = read("js/compliance-app.js");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function authSandbox(fetchImpl) {
  const localStorage = storage();
  const events = [];
  const window = {
    addEventListener() {},
    dispatchEvent: (event) => events.push(event),
    localStorage,
    location: { origin: "https://ehs-sil.com" },
  };
  const sandbox = {
    window,
    document: { addEventListener() {}, hidden: false, getElementById() { return null; } },
    localStorage,
    location: { pathname: "/index.html", search: "", origin: "https://ehs-sil.com" },
    fetch: fetchImpl,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    URL,
    URLSearchParams,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    AbortController,
    console,
  };
  window.window = window;
  vm.runInNewContext(authCode, sandbox);
  return { sandbox, events, localStorage };
}

let resolveFetch;
let fetchCalls = 0;
const pending = new Promise((resolve) => { resolveFetch = resolve; });
const dedupe = authSandbox(async () => { fetchCalls += 1; return pending; });
const first = dedupe.sandbox.window.EhsSilVip.getSession();
const second = dedupe.sandbox.window.EhsSilVip.getSession();
assert.equal(fetchCalls, 1, "同页初始会员状态读取必须合并请求");
resolveFetch({ ok: true, status: 200, json: async () => ({ ok: true, active: false, status: "inactive", capabilities: [] }) });
assert.equal((await first).status, "inactive");
assert.equal((await second).status, "inactive");

const failed = authSandbox(async () => { throw new TypeError("offline"); });
const errorState = await failed.sandbox.window.EhsSilVip.getSession();
assert.equal(errorState.status, "error");
assert.equal(errorState.active, false);

assert.equal(failed.sandbox.window.EhsSilVip.safeReturnTo("/tools/jsa-tool.html#result"), "/tools/jsa-tool.html#result");
for (const unsafe of ["https://evil.example/", "//evil.example/", "/tools/jsa-tool.html?company=secret", "/tools/../dashboard/register.html", "javascript:alert(1)"]) {
  assert.equal(failed.sandbox.window.EhsSilVip.safeReturnTo(unsafe), "", `必须拒绝不安全返回地址 ${unsafe}`);
}

const nicknameStorage = storage();
const vipStub = {
  nicknameKey: "ehs_display_nickname_v1",
  getState: () => ({ status: "inactive", active: false, capabilities: [] }),
  subscribe() {},
  getSession: async () => ({ status: "inactive", active: false, capabilities: [] }),
  membershipName: () => "工具箱会员",
  formatExpiry: () => "有效期以服务端记录为准",
};
const uiWindow = { EhsSilVip: vipStub };
const uiSandbox = {
  window: uiWindow,
  document: { querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { textContent: "" }; } },
  localStorage: nicknameStorage,
  location: { search: "" },
  URLSearchParams,
  console,
};
uiWindow.window = uiWindow;
vm.runInNewContext(membershipUiCode, uiSandbox);
assert.equal(uiWindow.EhsSilMembershipUI.normalizeNickname("安全小周"), "安全小周");
assert.equal(uiWindow.EhsSilMembershipUI.normalizeNickname("<img onerror=alert(1)>"), "");
uiWindow.EhsSilMembershipUI.saveNickname("测试用户01");
assert.equal(nicknameStorage.getItem("ehs_display_nickname_v1"), "测试用户01");
assert.deepEqual(vipStub.getState().capabilities, [], "本机昵称不得改变服务端能力");

for (const page of [home, read("tools/training-matrix.html"), read("tools/compliance-identification.html"), read("tools/jsa-tool.html"), read("tools/ehs-glossary.html"), read("tools/index.html")]) {
  assert.match(page, /site-shell\.js/, "首批页面必须接入公共状态与反馈组件");
}
assert.match(feedbackCode, /credentials:\s*'include'/);
assert.match(feedbackCode, /request_id:\s*form\.dataset\.requestId/);
assert.match(feedbackCode, /当前填写内容仍保留/);
assert.doesNotMatch(feedbackCode, /Object\.keys\(localStorage\)|document\.cookie|clipboard\.read/);
assert.match(adminCode, /require|feedback_admin/);
assert.match(adminCode, /description\.appendChild\(element\('p', '', item\.description\)\)/);
assert.doesNotMatch(adminCode, /innerHTML\s*=\s*item\.(?:description|display_nickname|contact_value)/);
assert.match(compliance, /data-feedback-entry="result"/);
assert.match(compliance, /data-public-entry-id/);
assert.match(training, /data-feedback-entry="result"/);
assert.match(training, /data-data-version/);

console.log(JSON.stringify({
  status: "PASS",
  membership_request_deduped: true,
  network_error_distinct: true,
  safe_return_path: true,
  nickname_cannot_grant_capability: true,
  result_feedback_context: ["compliance", "training"],
}));

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const analytics = read("js/analytics.js");
const tools = read("tools/index.html");
const regulations = read("tools/regulations.html");
const metrics = read("docs/product-metrics.md");

for (const event of [
  "search_submit",
  "search_no_result",
  "search_result_click",
  "tool_start",
  "tool_complete",
  "export_click",
  "vip_gate_view",
  "vip_cta_click",
  "planet_qr_click",
  "content_to_tool",
]) {
  assert.match(analytics, new RegExp(`['\"]${event}['\"]`), `事件字典缺少 ${event}`);
  assert.ok(metrics.includes("`" + event + "`"), `指标文档缺少 ${event}`);
}

for (const event of [
  "visit_incident_lfi",
  "incident_resource_click",
]) {
  assert.match(analytics, new RegExp(`['"]${event}['"]`), `LFI事件字典缺少 ${event}`);
  assert.ok(metrics.includes("`" + event + "`"), `指标文档缺少 ${event}`);
}

assert.match(analytics, /['"]incident_lfi['"]/);

for (const event of [
  "visit_jsa",
  "start_jsa",
  "complete_scene",
  "use_prompt",
  "finish_jsa",
  "export",
  "click_member",
  "return_visit",
]) {
  assert.match(analytics, new RegExp(`['"]${event}['"]`), `JSA事件字典缺少 ${event}`);
  assert.ok(metrics.includes("`" + event + "`"), `JSA指标文档缺少 ${event}`);
}

assert.match(analytics, /visit_jsa_coach:\s*['"]visit_jsa['"]/);
assert.match(analytics, /complete_jsa:\s*['"]finish_jsa['"]/);
assert.match(analytics, /print_or_export_result:\s*['"]export['"]/);
assert.match(analytics, /result_count_bucket/);
assert.match(analytics, /export_type/);
assert.doesNotMatch(analytics, /searchQuery|currentQuery/);

for (const event of [
  "reactivity_tool_view", "reactivity_search_started", "reactivity_identity_confirmed",
  "reactivity_pair_checked", "reactivity_matrix_generated", "reactivity_unknown_result",
  "reactivity_source_opened", "reactivity_export_started", "reactivity_upgrade_clicked",
]) {
  assert.match(analytics, new RegExp(`['"]${event}['"]`), `反应性工具事件字典缺少 ${event}`);
  assert.ok(metrics.includes("`" + event + "`"), `反应性工具指标文档缺少 ${event}`);
}

assert.match(tools, /src="\.\.\/js\/analytics\.js"/);
assert.match(tools, /track\(['"]search_submit['"]/);
assert.match(tools, /track\(['"]search_no_result['"]/);
assert.doesNotMatch(tools, /searchQuery\s*[:=].*_hmt/);

assert.match(regulations, /src="\.\.\/js\/analytics\.js"/);
assert.match(regulations, /track\(['"]search_result_click['"]/);
assert.match(regulations, /track\(['"]export_click['"]/);
assert.doesNotMatch(regulations, /currentQuery\s*[:=].*_hmt/);

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const dispatched = [];
const context = {
  window: {
    _hmt: [],
    console,
    dispatchEvent: (event) => dispatched.push(event),
  },
  sessionStorage: storage(),
  localStorage: storage(),
  CustomEvent: class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init.detail;
    }
  },
  Date,
  Math,
  JSON,
};
vm.runInNewContext(analytics, context);
context.window.EhsSilAnalytics.track("complete_jsa", {
  mode: "user",
  toolId: "jsa-coach",
  pageType: "jsa_coach",
  rawSearch: "不得上传的企业名称",
});
assert.equal(context.window._hmt[0][2], "finish_jsa");
assert.doesNotMatch(context.window._hmt[0][3], /不得上传的企业名称/);
assert.equal(dispatched[0].detail.event, "finish_jsa");
assert.equal(dispatched[0].detail.context.tool_id, "jsa-coach");

context.window.EhsSilAnalytics.track("export", { mode: "user", exportType: "xlsx" });
assert.equal(dispatched[1].detail.context.export_type, "xlsx");
assert.match(context.window._hmt[1][3], /\|xlsx\|/);

console.log(JSON.stringify({ status: "PASS", event_version: 1, funnel_events: 10, jsa_events: 8 }));

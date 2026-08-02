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

assert.match(analytics, /visit_jsa_coach:\s*['"]content_to_tool['"]/);
assert.match(analytics, /complete_jsa:\s*['"]tool_complete['"]/);
assert.match(analytics, /print_or_export_result:\s*['"]export_click['"]/);
assert.match(analytics, /result_count_bucket/);
assert.doesNotMatch(analytics, /searchQuery|currentQuery/);

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
assert.equal(context.window._hmt[0][2], "tool_complete");
assert.doesNotMatch(context.window._hmt[0][3], /不得上传的企业名称/);
assert.equal(dispatched[0].detail.event, "tool_complete");
assert.equal(dispatched[0].detail.context.tool_id, "jsa-coach");

console.log(JSON.stringify({ status: "PASS", event_version: 1, funnel_events: 10 }));

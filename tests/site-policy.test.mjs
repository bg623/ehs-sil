import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const home = read("index.html");
const jsa = read("tools/jsa-tool.html");
const register = read("dashboard/register.html");
const toolbox = read("products/toolbox.html");
const riskAnalysis = read("tools/risk-analysis.html");
const mainJs = read("js/main.js");
const siteShellJs = read("js/site-shell.js");
const styles = read("css/style.css");
const rules = JSON.parse(read("data/jsa-rules.json"));

const hero = home.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/)?.[0] || "";
assert.match(home, /<title>EHS-SIL · 外企EHS工具与成长工作台<\/title>/);
assert.match(home, /property="og:image" content="https:\/\/ehs-sil\.com\/assets\/og-ehs-sil-platform\.png"/);
assert.ok(fs.existsSync(new URL("../assets/og-ehs-sil-platform.png", import.meta.url)), "缺少首页社交分享图");
assert.match(hero, /EHS人的<br>专业工具台/);
assert.match(hero, />浏览专业工具</);
assert.match(hero, />了解EHS-SIL</);
assert.doesNotMatch(hero, /JSA专业教练|JSA检查/);
assert.equal(
  (hero.match(/class="btn /g) || []).length,
  2,
  "首页第一屏应保留工具入口和网站介绍两个行动",
);
assert.match(home, /class="nav-item has-dropdown"/);
assert.match(home, /class="nav-dropdown-toggle"/);
assert.match(home, /aria-expanded="false"/);
assert.match(siteShellJs, /dropdown-open/);
assert.match(siteShellJs, /event\.key !== 'Escape'/);
assert.match(home, /js\/site-shell\.js/);
assert.match(home, /JSA专业教练（试用版）/);
assert.match(home, /从遇到问题，到完成专业成果/);
assert.match(home, /试用版 · 持续优化/);
assert.match(home, /风险分析工具/);
assert.match(home, /事故学习工具/);
assert.match(home, /外企管理实践/);
assert.match(home, /class="workbench-card risk-tools-card" id="risk-tools"/);
assert.match(home, /class="workbench-card incident-tools-card" id="incident-tools"/);
assert.match(home, /class="workbench-card practice-tools-card" id="practice-tools"/);
assert.match(home, /href="tools\/training-matrix\.html"[^>]*data-home-action="start-training"/);
assert.match(home, /免费生成培训矩阵/);
assert.match(mainJs, /toolId: 'training-matrix'/);
assert.match(styles, /\.risk-tools-card/);
assert.match(styles, /\.incident-tools-card/);
assert.match(styles, /\.practice-tools-card/);
assert.match(home, /外企EHS工具箱会员/);
assert.match(home, /129/);
assert.doesNotMatch(home, /李工|王经理|陈同学|535条站内|70000|189<\/strong>|VIP专属/);
assert.doesNotMatch(home, /加入球星|735份|一次付费，永久使用/);

assert.doesNotMatch(jsa, /JSA得分|质量良好/);
assert.doesNotMatch(jsa, /function\s+(?:saveToLocal|loadFromLocal)\s*\(/);
assert.match(jsa, /JSA 专业教练 <span[^>]*>V0\.2 试用版/);
assert.match(jsa, /id="taskDescription"/);
assert.match(jsa, /id="generateDraftButton"/);
assert.match(jsa, /jsa-draft-generator\.js/);
assert.match(jsa, /vendor\/exceljs\.min\.js/);
assert.match(jsa, /id="exportExcelButton"/);
assert.match(jsa, /async function exportJsaExcel\(\)/);
assert.match(jsa, /请先完成完整性检查/);
for (const status of ["已覆盖", "建议关注", "需要人工确认"]) {
  assert.match(jsa, new RegExp(status));
}
assert.match(jsa, /不代表作业安全、法规符合、作业批准或风险可接受/);

assert.match(register, /停止销售29\.9元独立VIP/);
assert.doesNotMatch(register, /付款二维码|扫码支付|立即购买29\.9/);
assert.doesNotMatch(`${register}\n${toolbox}`, /一次付费.{0,8}永久使用/);
assert.match(toolbox, /129/);
assert.match(toolbox, /元\/年/);
assert.match(read("tools/index.html"), /网站当前用于检索和内容预览，不提供文件下载/);
assert.match(read("tools/index.html"), /正式发布及可下载文件以知识星球为准/);
assert.match(riskAnalysis, /<h3>JSA 工作安全分析<\/h3>/);
assert.match(riskAnalysis, /专业教练 V0\.2试用版/);
assert.match(riskAnalysis, /href="jsa-tool\.html"[^>]*>开始JSA分析/);
assert.doesNotMatch(riskAnalysis, /VIP专属|VIP在线工具|查看 VIP 权益/);

assert.equal(rules.publication_status, "production_ready_product_owner_approved");
assert.ok(rules.rules.length > 0);
assert.equal(
  rules.rules.filter((rule) => rule.status === "approved").length,
  11,
  "应记录产品负责人批准的11条规则",
);
assert.equal(
  rules.rules.filter((rule) => rule.status === "changes_requested").length,
  0,
  "双语显示和来源复核后不应保留待修改规则",
);
assert.equal(
  rules.rules.filter((rule) => rule.production_status === "production_ready").length,
  11,
  "获得产品负责人最终上线批准后，11条规则均应进入生产就绪状态",
);

console.log(
  JSON.stringify({
    status: "PASS",
    hero_actions: 2,
    jsa_location: "compact-home-and-risk-analysis",
    candidate_rules: rules.rules.length,
    professionally_approved_rules: 11,
    changes_requested_rules: 0,
    deployment_ready_rules: rules.rules.filter(
      (rule) => rule.production_status === "production_ready",
    ).length,
  }),
);

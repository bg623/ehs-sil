import fs from "node:fs";

const reportPath = process.argv[2];
const summaryPath = process.argv[3] || process.env.GITHUB_STEP_SUMMARY;

if (!reportPath) {
  console.error("Usage: node scripts/evaluate-regulation-source-check.mjs <report.json> [summary.md]");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Invalid regulation source report: ${error.message}`);
  process.exit(2);
}

const sources = Array.isArray(report.sources) ? report.sources : [];
const failed = sources.filter((source) => source.status !== "available");
const lines = [
  "## 法规官方来源健康检查",
  "",
  `检查时间：${report.checkedAt || "未记录"}`,
  "",
  "| 来源 | 模式 | 状态 | HTTP/错误 |",
  "|---|---|---|---|",
  ...sources.map((source) =>
    `| ${source.name} | ${source.mode} | ${source.status} | ${source.httpStatus || source.error || "—"} |`,
  ),
  "",
  failed.length
    ? `结论：${failed.length}个来源不可用，必须人工复核；正式法规库未被修改。`
    : "结论：所有来源入口可访问；本检查不代表法规内容或版本已经人工确认。",
  "",
];

const summary = lines.join("\n");
console.log(summary);
if (summaryPath) fs.appendFileSync(summaryPath, summary, "utf8");

if (failed.length) process.exit(1);

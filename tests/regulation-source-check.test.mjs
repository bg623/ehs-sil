import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const evaluator = new URL("../scripts/evaluate-regulation-source-check.mjs", import.meta.url);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ehs-source-check-"));

function runFixture(name, sources) {
  const reportPath = path.join(tempDir, `${name}.json`);
  const summaryPath = path.join(tempDir, `${name}.md`);
  fs.writeFileSync(reportPath, JSON.stringify({ checkedAt: "2026-08-02T00:00:00Z", sources }));
  const result = spawnSync(process.execPath, [evaluator.pathname, reportPath, summaryPath], { encoding: "utf8" });
  return { result, summary: fs.readFileSync(summaryPath, "utf8") };
}

const success = runFixture("success", [
  { name: "官方来源A", mode: "official_entry_check", status: "available", httpStatus: 200 },
]);
assert.equal(success.result.status, 0);
assert.match(success.summary, /所有来源入口可访问/);
assert.match(success.summary, /不代表法规内容或版本已经人工确认/);

const failure = runFixture("failure", [
  { name: "官方来源B", mode: "official_entry_check", status: "failed", error: "timeout" },
]);
assert.equal(failure.result.status, 1);
assert.match(failure.summary, /必须人工复核/);
assert.match(failure.summary, /正式法规库未被修改/);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(JSON.stringify({ status: "PASS", success_path: true, failure_path: true }));

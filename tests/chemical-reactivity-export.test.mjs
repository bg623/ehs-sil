import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { buildCompatibilityMatrix, summarizeMatrix, deriveStorageActions } from "../js/chemical-reactivity-engine.mjs";
import { buildReactivityWorkbook } from "../js/chemical-reactivity-export.mjs";

const require = createRequire(import.meta.url);
const ExcelJS = require("../vendor/exceljs.min.js");
const fixture = JSON.parse(fs.readFileSync(new URL("../data/chemical-reactivity/fixtures.synthetic.json", import.meta.url), "utf8"));
const records = fixture.chemicals;
const manifest = { dataVersion: "SYNTH-1", sourceMode: "test", generatedAt: "2026-08-30", reviewedAt: "2026-08-30", rightsGate: { testOnly: true } };
const matrix = buildCompatibilityMatrix(records, { groupPairs: fixture.groupPairs, directEvidence: [], sourceManifest: manifest });
const summary = summarizeMatrix(matrix);
summary.pairs.forEach((pair) => { pair.storageActions = deriveStorageActions(pair); });

const workbook = buildReactivityWorkbook(ExcelJS, { records, matrix, summary, manifest });
const buffer = await workbook.xlsx.writeBuffer();
assert.ok(buffer.length > 10000);
assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");

const reread = new ExcelJS.Workbook();
await reread.xlsx.load(buffer);
assert.deepEqual(reread.worksheets.map((sheet) => sheet.name), [
  "说明与限制", "化学品主表", "两两相容矩阵", "不相容明细", "谨慎与未知",
  "可能气体与后果", "隔离核实清单", "证据与来源", "数据版本与变更"
]);
assert.equal(reread.getWorksheet("两两相容矩阵").getCell("B2").value, "NOT_APPLICABLE");
assert.ok(reread.getWorksheet("谨慎与未知").rowCount >= 2, "UNKNOWN 必须单独导出");
assert.match(reread.getWorksheet("说明与限制").getCell("B2").value, /不代表相容、安全/);
assert.equal(reread.getWorksheet("化学品主表").getCell("H2").value, "SYNTH/1");
console.log(JSON.stringify({ status: "PASS", bytes: buffer.length, sheets: reread.worksheets.length, unknownRows: reread.getWorksheet("谨慎与未知").rowCount - 1 }));

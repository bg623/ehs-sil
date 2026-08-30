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
const scenario = { id: "SYNTH-SCENARIO", mode: "CUSTOM", name: "合成导出情景", temperatureMaxC: 50, insulatedVessel: true, airtightVessel: true, durationHours: 48, sourceRefs: records[0].sourceRefs };
const matrix = buildCompatibilityMatrix(records, { groupPairs: fixture.groupPairs, directEvidence: [], sourceManifest: manifest, scenario });
const summary = summarizeMatrix(matrix);
summary.pairs.forEach((pair) => { pair.storageActions = deriveStorageActions(pair); });

const project = { name: "合成项目", site: "测试区", createdBy: "A", reviewedBy: "B", createdAt: "2026-08-30", lastReviewedAt: "2026-08-30", status: "DRAFT", version: 1, notes: "仅测试", scenario, history: [] };
const overrides = [{ id: "OV-1", pairKey: "A::B", predictedStatus: "INCOMPATIBLE", revisedStatus: "CAUTION", reason: "测试", status: "DRAFT", createdBy: "A", createdAt: "2026-08-30", evidenceRefs: records[0].sourceRefs }];
const workbook = buildReactivityWorkbook(ExcelJS, { records, matrix, summary, manifest, project, scenario, overrides, ruleVersion: "CRIM-2026.08-v2.1", referenceToolVersion: "CRW 4.0.3" });
const buffer = await workbook.xlsx.writeBuffer();
assert.ok(buffer.length > 10000);
assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");

const reread = new ExcelJS.Workbook();
await reread.xlsx.load(buffer);
assert.deepEqual(reread.worksheets.map((sheet) => sheet.name), [
  "说明与限制", "化学品主表", "两两相容矩阵", "不相容明细", "谨慎与未知",
  "可能气体与后果", "隔离核实清单", "证据与来源", "人工修订记录", "项目备注", "数据版本与变更"
]);
assert.equal(reread.getWorksheet("两两相容矩阵").getCell("B2").value, "SR");
assert.ok(reread.getWorksheet("谨慎与未知").rowCount >= 2, "UNKNOWN 必须单独导出");
assert.match(reread.getWorksheet("说明与限制").getCell("B2").value, /不代表相容、安全/);
assert.match(reread.getWorksheet("说明与限制").getColumn(2).values.join(" "), /CRW 默认参考情景|用户自定义/);
assert.equal(reread.getWorksheet("人工修订记录").getCell("A2").value, "OV-1");
assert.match(reread.getWorksheet("化学品主表").getCell("J2").value, /SYNTH\/A\/1/);
console.log(JSON.stringify({ status: "PASS", bytes: buffer.length, sheets: reread.worksheets.length, unknownRows: reread.getWorksheet("谨慎与未知").rowCount - 1 }));

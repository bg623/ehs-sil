import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ExcelJS = require("../vendor/exceljs.min.js");
const exporter = require("../js/jsa-export.js");

const workbook = exporter.buildWorkbook(ExcelJS, {
  meta: {
    jobName: "离心泵机械密封更换",
    jobRef: "JSA-2026-TEST",
    department: "公用工程 / 泵房",
    assessor: "人工确认人",
    date: "2026-08-09",
    taskDescription: "承包商拆卸输送化学品的离心泵，更换机械密封后复装试运。",
  },
  scenarioLabels: ["设备检维修", "设备或管线打开"],
  tagLabels: ["机械能", "气压", "化学品"],
  steps: [
    { step: 1, desc: "停机并实施危险能量隔离", hazard: "意外启动和残余压力", existingCtrl: "上锁挂牌并排空泄压", addCtrl: "验证零能量", L: 2, S: 5, R: 10 },
    { step: 2, desc: "拆卸机械密封", hazard: "残余物料、夹挤和部件坠落", existingCtrl: "受控打开并使用支撑", addCtrl: "异常时停止并重新评估", L: 3, S: 4, R: 12 },
  ],
  findings: [
    { rule_id: "JSA-ENERGY-001", rule_name: "危险能量隔离", severity: "high", prompt_text: "建议确认全部能量源。", reason: "存在检维修和设备打开。", recommended_action: "验证零能量状态。", source: ["GB-T-44686-2024"], version: "1.0" },
  ],
  confirmedRuleIds: {},
});

const buffer = await workbook.xlsx.writeBuffer();
assert.ok(buffer.length > 9000);
assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");

const reread = new ExcelJS.Workbook();
await reread.xlsx.load(buffer);
assert.deepEqual(reread.worksheets.map((sheet) => sheet.name), ["JSA工作表", "完整性检查", "使用说明"]);
const jsa = reread.getWorksheet("JSA工作表");
assert.equal(jsa.getCell("B4").value, "离心泵机械密封更换");
assert.equal(jsa.getCell("H11").value.formula, "F11*G11");
assert.match(jsa.getCell("I11").value.formula, /^IF\(H11<=4/);
assert.equal(jsa.getCell("F11").dataValidation.type, "list");
assert.equal(jsa.getCell("J11").dataValidation.type, "list");
assert.equal(jsa.pageSetup.orientation, "landscape");
assert.match(jsa.getCell("A2").value, /不代表作业安全/);
const checks = reread.getWorksheet("完整性检查");
assert.equal(checks.getCell("C7").value, "需要人工确认");
assert.equal(checks.getCell("C7").dataValidation.type, "list");
assert.match(reread.getWorksheet("使用说明").getCell("B7").value, /不代表作业安全/);
assert.match(exporter.fileName("泵/阀检修", "2026-08-09"), /^EHS-SIL_JSA_泵-阀检修_2026-08-09\.xlsx$/);

console.log(JSON.stringify({ status: "PASS", bytes: buffer.length, sheets: reread.worksheets.length, formulas: 2, validations: 3 }));

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const generator = require("../js/jsa-draft-generator.js");
const templates = JSON.parse(fs.readFileSync(new URL("../data/jsa-draft-templates.json", import.meta.url), "utf8"));

const pumpDraft = generator.createDraft({
  jobName: "甲醛储罐出口管线法兰更换",
  taskDescription: "承包商对甲醛储罐出口管线进行停用检修，拆开法兰更换垫片，需要排空泄压和清洗。",
}, templates);

for (const expected of ["maintenance", "equipment_opening", "chemical_handling"]) {
  assert.ok(pumpDraft.scenarios.includes(expected), `应识别 ${expected}`);
}
for (const expected of ["mechanical", "pneumatic", "chemical"]) {
  assert.ok(pumpDraft.tags.includes(expected), `应识别 ${expected}`);
}
for (const expectedKey of ["energy_isolation", "depressure_drain_purge", "opening_equipment", "restore_and_handover"]) {
  assert.ok(pumpDraft.steps.some((step) => step.key === expectedKey), `初稿应包含 ${expectedKey}`);
}
assert.equal(pumpDraft.contractor_work, true);
assert.ok(pumpDraft.steps.length >= 6 && pumpDraft.steps.length <= 12);
assert.ok(pumpDraft.steps.every((step, index) => step.step === index + 1 && step.R === step.L * step.S));

const combinedDraft = generator.createDraft({
  jobName: "屋顶钢结构焊接吊装",
  taskDescription: "在屋顶高处使用吊车吊装钢梁并进行焊接和打磨，现场存在交叉作业。",
}, templates);
for (const expected of ["hot_work", "work_at_height", "lifting"]) {
  assert.ok(combinedDraft.scenarios.includes(expected), `复合作业应识别 ${expected}`);
}
assert.equal(combinedDraft.simultaneous_operations, true);
assert.ok(combinedDraft.steps.some((step) => step.key === "gas_test_and_hot_work"));
assert.ok(combinedDraft.steps.some((step) => step.key === "height_execution"));
assert.ok(combinedDraft.steps.some((step) => step.key === "lifting_execution"));

const genericDraft = generator.createDraft({
  jobName: "现场临时任务",
  taskDescription: "在指定区域完成物品整理和状态核对，首次实施。",
}, templates);
assert.ok(genericDraft.steps.some((step) => step.key === "generic_execution"));
assert.equal(genericDraft.non_routine, true);

const allScenarioKeys = Object.keys(templates.scenario_keywords);
const allScenarioDraft = generator.createDraft({
  jobName: "复合特殊作业",
  taskDescription: "用于验证全部人工选择场景均不会被固定步骤上限静默删除。",
  scenarios: allScenarioKeys,
}, templates);
for (const scenario of allScenarioKeys) {
  const scenarioKeys = templates.scenario_steps[scenario].map((step) => step.key);
  assert.ok(scenarioKeys.some((key) => allScenarioDraft.steps.some((step) => step.key === key)), `复合作业不应遗漏 ${scenario}`);
}

const allText = JSON.stringify([pumpDraft, combinedDraft, genericDraft]);
assert.doesNotMatch(allText, /作业已经安全|可以批准作业|符合法规|风险已经可接受/);

console.log(JSON.stringify({ status: "PASS", pumpSteps: pumpDraft.steps.length, combinedSteps: combinedDraft.steps.length, genericSteps: genericDraft.steps.length }));

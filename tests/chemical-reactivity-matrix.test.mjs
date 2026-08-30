import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  STATUSES,
  normalizeCas,
  normalizeUn,
  normalizeName,
  pairKey,
  cartesianProduct,
  resolveIdentity,
  predictChemicalPair,
  buildCompatibilityMatrix,
  summarizeMatrix,
  validateProductionData,
  createUserDraftRecord
} from "../js/chemical-reactivity-engine.mjs";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const fixture = readJson("data/chemical-reactivity/fixtures.synthetic.json");
const [acid, base, unknown] = fixture.chemicals;
const sourceManifest = { dataVersion: "SYNTH-1", sourceMode: "test" };
const data = { groupPairs: fixture.groupPairs, directEvidence: [], sourceManifest };

test("CAS、UN 与名称规范化", () => {
  assert.equal(normalizeCas(" 67-64-1 "), "67-64-1");
  assert.throws(() => normalizeCas("67-64-2"), /校验位/);
  assert.equal(normalizeUn("un 1090"), "UN1090");
  assert.equal(normalizeName("  Test　Name "), "test name");
});

test("身份多候选、混合物资料缺失会阻断", () => {
  const records = [
    { ...acid, id: "A1", preferredName: "候选物", searchableNames: [] },
    { ...acid, id: "A2", preferredName: "候选物", searchableNames: [] }
  ];
  assert.equal(resolveIdentity("候选物", records).status, "MULTIPLE");
  assert.throws(() => createUserDraftRecord({ preferredName: "混合物", mixtureFlag: true, sdsVersion: "2026" }), /混合物必须/);
});

test("多反应组展开全部笛卡尔积且组对键无方向", () => {
  assert.deepEqual(cartesianProduct(["A", "B"], ["C", "D"]), [["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"]]);
  assert.equal(pairKey("Z", "A"), "A::Z");
});

test("A+B 与 B+A 完全一致，证据和气体不丢失", () => {
  const forward = predictChemicalPair(acid, base, data);
  const reverse = predictChemicalPair(base, acid, data);
  assert.equal(forward.status, STATUSES.INCOMPATIBLE);
  assert.equal(reverse.status, STATUSES.INCOMPATIBLE);
  assert.deepEqual(forward.consequenceTags.sort(), reverse.consequenceTags.sort());
  assert.deepEqual(forward.possibleGases, ["合成测试气体（不可公开）"]);
  assert.equal(forward.evidence.length, 2);
  assert.equal(forward.missingGroupPairs.length, 0);
});

test("缺反应组或组对规则时 UNKNOWN 永不变绿", () => {
  const result = predictChemicalPair(base, unknown, data);
  assert.equal(result.status, STATUSES.UNKNOWN);
  assert.match(result.disclaimer, /不代表安全批准/);
});

test("缺少某一组对不吞掉 UNKNOWN，但不相容证据仍触发最严控制", () => {
  const reduced = { ...data, groupPairs: fixture.groupPairs.slice(0, 1) };
  const result = predictChemicalPair(acid, base, reduced);
  assert.equal(result.status, STATUSES.INCOMPATIBLE);
  assert.equal(result.missingGroupPairs.length, 1);
});

test("直接证据与组对证据冲突触发 CONFLICT_REVIEW", () => {
  const directEvidence = [{
    id: "DIRECT-1", chemicalAId: acid.id, chemicalBId: base.id,
    status: "NO_PREDICTED_HAZARD", consequenceTags: [], possibleGases: [], summary: "合成冲突证据",
    sourceRefs: acid.sourceRefs
  }];
  const result = predictChemicalPair(acid, base, { ...data, directEvidence });
  assert.equal(result.status, STATUSES.CONFLICT_REVIEW);
  assert.equal(result.evidence.length, 3);
});

test("矩阵对称、对角线不适用且汇总只计一次", () => {
  const matrix = buildCompatibilityMatrix([acid, base, unknown], data);
  assert.equal(matrix[0][0].status, STATUSES.NOT_APPLICABLE);
  assert.strictEqual(matrix[0][1], matrix[1][0]);
  const summary = summarizeMatrix(matrix);
  assert.equal(summary.pairs.length, 3);
  assert.equal(summary.counts.INCOMPATIBLE, 1);
  assert.equal(summary.counts.UNKNOWN, 2);
});

test("生产数据闸门拒绝 TEST_ONLY 和未经授权快照", () => {
  const manifest = readJson("data/chemical-reactivity/source-manifest.json");
  assert.equal(validateProductionData({ manifest, chemicals: [], groupPairs: [], directEvidence: [] }), true);
  assert.throws(() => validateProductionData({ manifest, chemicals: [acid] }), /TEST_ONLY|official_assist/);
  assert.throws(() => validateProductionData({ manifest: { ...manifest, sourceMode: "approved_snapshot" }, chemicals: [] }), /授权清单/);
});

test("公开页面只加载生产数据，不引用 fixture 或旧职业健康逻辑", () => {
  const html = fs.readFileSync(new URL("../tools/chemical-reactivity-matrix.html", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../js/chemical-reactivity-matrix.mjs", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/chemical-reactivity-matrix.css", import.meta.url), "utf8");
  const config = fs.readFileSync(new URL("../data/chemical-reactivity/config.json", import.meta.url), "utf8");
  assert.doesNotMatch(html + app, /fixtures\.synthetic|chemical-risk-engine|THI|B\/WB\/WD\/WL\/G|control_banding/);
  assert.match(html, /化学品反应与禁忌矩阵/);
  assert.match(config, /official_assist/);
  assert.deepEqual(JSON.parse(config).freeMatrixLimit, 10);
  assert.deepEqual(JSON.parse(config).memberMatrixLimit, 100);
  assert.match(app, /ehs_sil_chemical_reactivity_v2/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(app, /track\([^)]*(chemicalName|casNumber|unNumber|location)/s);
});

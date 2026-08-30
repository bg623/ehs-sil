import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  applyMandatoryUpgrades, calculateExposureRatios, calculateMeasuredGrade,
  calculateMixedExposureRatio, calculateThi, collectRedFlags,
  determineControlApproach, mapHazardClassifications, mapHazardDegreeToWd,
  parseNumber, selectMaxExposureRatio
} from "../js/chemical-risk-engine.mjs";

const control = JSON.parse(fs.readFileSync(new URL("../data/control-banding-v1.json", import.meta.url), "utf8"));

test("路线B边界、候选比值与强制提级", () => {
  assert.equal(calculateMeasuredGrade({ wd: 8, b: 0.5, wl: 1 }).wb, 0);
  assert.equal(calculateMeasuredGrade({ wd: 8, b: 0.5001, wl: 1 }).wb, 0.5001);
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 6, wl: 1 }).rawGrade, "I");
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 6.0001, wl: 1 }).rawGrade, "II");
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 24, wl: 1 }).rawGrade, "II");
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 24.0001, wl: 1 }).rawGrade, "III");
  const candidates = calculateExposureRatios({ twa: 40, pcTwa: 100, stel: 60, pcStel: 100, unit: "mg/m³" });
  assert.equal(selectMaxExposureRatio(candidates).name, "B_STEL");
  assert.equal(selectMaxExposureRatio(calculateExposureRatios({ twa: 10, pcTwa: 20, peak: 45 })).value, 0.75);
  assert.equal(calculateMixedExposureRatio([0.2, 0.3, 0.5]), 1);
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 1.1, wl: 1 }).adjustedGrade, "II");
  assert.equal(applyMandatoryUpgrades("I", { cmr: true }).grade, "II");
  assert.equal(applyMandatoryUpgrades("II", { sensitizer: true }).grade, "III");
  assert.equal(applyMandatoryUpgrades("0", { skinAbsorption: true }).grade, "I");
  assert.equal(calculateMeasuredGrade({ hasOel: false }).status, "needs_alternative");
  assert.equal(calculateMeasuredGrade({ wd: 1, b: 0.2, wl: 1, sampleCompliant: false }).status, "trial");
});

test("路线B拒绝单位错误和无效数值", () => {
  assert.throws(() => calculateExposureRatios({ twa: 1, pcTwa: 2, unit: "ppm", limitUnit: "mg/m³" }), /单位不一致/);
  assert.throws(() => parseNumber("0,5"), /小数点/);
  assert.throws(() => parseNumber(-1), /大于或等于/);
  assert.throws(() => parseNumber(NaN), /有限/);
  assert.throws(() => parseNumber(Infinity), /有限/);
});

test("THI、WD与缺失数据规则", () => {
  const result = calculateThi([
    { key: "acuteInhalation", category: 1, weight: 5 },
    { key: "dermal", category: 2, weight: 2 },
    { key: "irritation", category: 3, weight: 3 },
    { key: "sensitisation", category: 1, weight: 3 },
    { key: "reproductiveToxicity", category: 4, weight: 3 },
    { key: "carcinogenicity", category: 5, weight: 5 },
    { key: "dispersion", category: 2, weight: 3 },
    { key: "accumulation", category: 5, weight: 1 }
  ]);
  assert.equal(result.thi, 56);
  assert.equal(result.degree, "high");
  assert.equal(mapHazardDegreeToWd("light", { highToxic: true }), 8);
  assert.equal(mapHazardDegreeToWd("high"), 4);
});

test("路线A矩阵与适用边界", () => {
  assert.equal(determineControlApproach("A", "medium", "high", control.matrix), 2);
  assert.equal(determineControlApproach("B", "large", "medium_dustiness", control.matrix), 3);
  assert.equal(determineControlApproach("C", "medium", "medium_volatility", control.matrix), 3);
  assert.equal(determineControlApproach("D", "small", "low", control.matrix), 2);
  assert.equal(determineControlApproach("E", "small", "low", control.matrix), 4);
  const mapped = mapHazardClassifications(["skin_sensitisation_1", "acute_toxicity_4"], control.hazardClassifications);
  assert.equal(mapped.hazardBand, "C");
  assert.equal(mapped.skinBand, true);
  assert.equal(mapHazardClassifications(["unknown"], control.hazardClassifications).hazardBand, null);
  assert.throws(() => determineControlApproach(null, "small", "low", control.matrix), /待人工确认/);
  assert.ok(collectRedFlags({ physicalProcess: true, outsideScope: true }).length === 2);
});

test("静态页面保留隐私、双路线、无付费墙安全结论和移动端约束", () => {
  const html = fs.readFileSync(new URL("../tools/chemical-risk-matrix.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/chemical-risk-matrix.css", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../js/chemical-risk-matrix.mjs", import.meta.url), "utf8");
  assert.match(html, /快速控制分级/);
  assert.match(html, /检测数据分级/);
  assert.match(html, /数据默认仅保存在本机/);
  assert.match(html, /完整计算路径/);
  assert.match(html, /导出完整台账（VIP）/);
  assert.match(app, /ehs_sil_chemical_risk_matrix_v1/);
  const analyticsWrapper = app.match(/function track\([\s\S]*?\n}\n\nfunction hydrate/)?.[0] || "";
  assert.doesNotMatch(analyticsWrapper, /chemicalName|\bcas\b|taskName|reportNo|\btwa\b|pcTwa/);
  assert.match(css, /@media \(max-width:\s*640px\)/);
  assert.match(css, /min-height:\s*44px/);
});

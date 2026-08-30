const BAND_ORDER = { A: 1, B: 2, C: 3, D: 4, E: 5 };
const GRADE_ORDER = { "0": 0, I: 1, II: 2, III: 3 };

export function parseNumber(value, field = "数值", { allowZero = true } = {}) {
  if (typeof value === "string" && value.includes(",")) throw new Error(`${field} 请使用小数点，不要使用逗号`);
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} 必须是有限数值`);
  if (number < 0 || (!allowZero && number === 0)) throw new Error(`${field} 必须${allowZero ? "大于或等于" : "大于"} 0`);
  return number;
}

export function calculateExposureRatios(input = {}) {
  const measuredUnit = String(input.unit || "").trim();
  const limitUnit = String(input.limitUnit || input.unit || "").trim();
  if (measuredUnit && limitUnit && measuredUnit !== limitUnit) throw new Error("检测浓度与接触限值单位不一致，请先完成换算");
  const candidates = [];
  const ratio = (name, measured, limit, label) => {
    const c = parseNumber(measured, `${label}检测值`);
    const oel = parseNumber(limit, `${label}限值`, { allowZero: false });
    if (c === null && oel === null) return;
    if (c === null || oel === null) throw new Error(`${label}检测值与限值必须成对填写`);
    candidates.push({ name, measured: c, limit: oel, value: c / oel });
  };
  ratio("B_TWA", input.twa, input.pcTwa, "TWA");
  ratio("B_STEL", input.stel, input.pcStel, "STEL");
  if (input.peak !== "" && input.peak !== null && input.peak !== undefined) {
    if (input.pcStel !== "" && input.pcStel !== null && input.pcStel !== undefined) {
      throw new Error("已有 PC-STEL 时应填写 STEL 检测值，不使用 3 × PC-TWA 峰浓度规则");
    }
    const peak = parseNumber(input.peak, "峰浓度");
    const pcTwa = parseNumber(input.pcTwa, "PC-TWA", { allowZero: false });
    if (pcTwa === null) throw new Error("计算峰浓度比值需要 PC-TWA");
    candidates.push({ name: "B_peak", measured: peak, limit: 3 * pcTwa, value: peak / (3 * pcTwa) });
  }
  ratio("B_MAC", input.macMeasured, input.macLimit, "MAC");
  if (!candidates.length) throw new Error("至少填写一组有效的检测值与职业接触限值");
  return candidates;
}

export function selectMaxExposureRatio(candidates = []) {
  if (!candidates.length) return null;
  return candidates.reduce((max, item) => item.value > max.value ? item : max);
}

export function calculateMixedExposureRatio(ratios = []) {
  if (!ratios.length) throw new Error("至少需要一个化学物的 B 值");
  return ratios.reduce((sum, value) => sum + parseNumber(value, "B 值"), 0);
}

export function mapHazardDegreeToWd(degree, flags = {}) {
  if (flags.highToxic || flags.acuteToxicityCat1) return 8;
  const values = { light: 1, moderate: 2, high: 4, extreme: 8 };
  if (!values[degree]) throw new Error("请选择有效的毒物危害程度");
  return values[degree];
}

export function calculateThi(items = []) {
  if (!Array.isArray(items) || !items.length) throw new Error("请填写 THI 分项");
  const details = items.map((item) => {
    const category = parseNumber(item.category, `${item.label || item.key}类别`, { allowZero: false });
    const weight = parseNumber(item.weight, `${item.label || item.key}权重`, { allowZero: false });
    if (category < 1 || category > 5 || !Number.isInteger(category)) throw new Error(`${item.label || item.key}类别必须为 1–5`);
    const score = 5 - category;
    return { ...item, category, weight, score, weightedScore: score * weight };
  });
  const thi = details.reduce((sum, item) => sum + item.weightedScore, 0);
  const degree = thi < 35 ? "light" : thi < 50 ? "moderate" : thi < 65 ? "high" : "extreme";
  return { thi, degree, details };
}

export function gradeFromG(g) {
  if (g === 0) return "0";
  if (g <= 6) return "I";
  if (g <= 24) return "II";
  return "III";
}

export function applyMandatoryUpgrades(rawGrade, { b = 0, cmr = false, sensitizer = false, skinAbsorption = false } = {}) {
  if (!(rawGrade in GRADE_ORDER)) throw new Error("无效的原始作业级别");
  let level = GRADE_ORDER[rawGrade];
  const reasons = [];
  if (b > 1 && level < 2) {
    level = 2;
    reasons.push("B > 1，最终不得低于Ⅱ级");
  }
  if (cmr || sensitizer || skinAbsorption) {
    level = Math.min(3, level + 1);
    reasons.push("存在致畸/致癌/致突变/致敏或经皮吸收危害，提升一级");
  }
  return { grade: Object.keys(GRADE_ORDER).find((key) => GRADE_ORDER[key] === level), reasons };
}

export function calculateMeasuredGrade(input = {}) {
  if (input.hasOel === false) return { status: "needs_alternative", reason: "无职业接触限值，不能按 0 处理；请转路线 A 或按 GBZ/T 298 专项评估" };
  const wd = parseNumber(input.wd, "WD", { allowZero: false });
  const b = parseNumber(input.b, "B");
  const wl = parseNumber(input.wl, "WL", { allowZero: false });
  const wb = b <= 0.5 ? 0 : b;
  const g = wd * wb * wl;
  const rawGrade = gradeFromG(g);
  const upgraded = applyMandatoryUpgrades(rawGrade, { b, ...(input.flags || {}) });
  return {
    status: input.sampleCompliant === false ? "trial" : "formal_assist",
    wd, b, wb, wl, g, rawGrade, adjustedGrade: upgraded.grade,
    upgradeReasons: upgraded.reasons,
    rationale: [`WD ${wd} × WB ${wb} × WL ${wl} = G ${g}`, `原始级别 ${rawGrade}级`, ...upgraded.reasons]
  };
}

export function mapHazardClassifications(selected = [], definitions = []) {
  const matches = definitions.filter((item) => selected.includes(item.id));
  if (!matches.length) return { hazardBand: null, skinBand: false, unmatched: selected.slice() };
  const hazardBand = matches.reduce((band, item) => BAND_ORDER[item.band] > BAND_ORDER[band] ? item.band : band, "A");
  const known = new Set(matches.map((item) => item.id));
  return { hazardBand, skinBand: matches.some((item) => item.skin), unmatched: selected.filter((id) => !known.has(id)) };
}

export function determineControlApproach(hazardBand, amount, potential, matrix) {
  if (!BAND_ORDER[hazardBand]) throw new Error("危害组待人工确认，不能默认按 A 组计算");
  const level = matrix?.[hazardBand]?.[amount]?.[potential];
  if (!level) throw new Error("用量或挥发/扬尘等级不完整");
  return Number(level);
}

export function collectRedFlags(input = {}) {
  const flags = [];
  const labels = {
    physicalProcess: "物理/工艺危险需独立开展 JSA、What-If、HAZOP/LOPA、MOC 或专项工程复核",
    cmr: "存在致癌、致突变或生殖毒性危害",
    skinAbsorption: "存在经皮吸收危害",
    corrosive: "存在皮肤腐蚀/刺激或严重眼损伤/刺激，必须保留防护措施",
    noOel: "无职业接触限值，不得视为合格或填 0",
    sampleNoncompliant: "采样不符合 GBZ 159 最低要求，只能作为试算",
    outsideScope: "超出快速控制分级直接适用范围，需专项评估"
  };
  Object.keys(labels).forEach((key) => { if (input[key]) flags.push({ key, label: labels[key] }); });
  return flags;
}

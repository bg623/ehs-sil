export const STATUSES = Object.freeze({
  INCOMPATIBLE: "INCOMPATIBLE",
  CAUTION: "CAUTION",
  NO_PREDICTED_HAZARD: "NO_PREDICTED_HAZARD",
  UNKNOWN: "UNKNOWN",
  CONFLICT_REVIEW: "CONFLICT_REVIEW",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export const STATUS_META = Object.freeze({
  INCOMPATIBLE: { label: "不相容", icon: "⛔" },
  CAUTION: { label: "谨慎，需进一步核实", icon: "⚠" },
  NO_PREDICTED_HAZARD: { label: "未预测到两两不相容", icon: "ⓘ" },
  UNKNOWN: { label: "资料不足 / 未知", icon: "?" },
  CONFLICT_REVIEW: { label: "数据冲突，人工复核", icon: "◆" },
  NOT_APPLICABLE: { label: "不适用", icon: "／" }
});

const SOURCE_FIELDS = ["sourceId", "title", "version", "reviewedAt", "licenseClass"];
const ESCALATION_TAGS = new Set([
  "GENERATES_HEAT", "GENERATES_GAS", "PRESSURIZATION", "INTENSE_OR_EXPLOSIVE",
  "FIRE_RISK", "FLAMMABLE_GAS", "TOXIC_PRODUCT", "CORROSIVE_PRODUCT",
  "POLYMERIZATION", "DECOMPOSITION", "WATER_REACTIVE", "AIR_REACTIVE", "CATALYTIC_EFFECT"
]);

export function normalizeName(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function normalizeCas(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, "");
  if (!normalized) return "";
  if (!/^\d{2,7}-\d{2}-\d$/.test(normalized)) throw new Error("CAS 格式应为 2–7 位数字-2 位数字-1 位数字");
  const digits = normalized.replace(/-/g, "");
  const check = Number(digits.at(-1));
  const sum = digits.slice(0, -1).split("").reverse().reduce((total, digit, index) => total + Number(digit) * (index + 1), 0);
  if (sum % 10 !== check) throw new Error("CAS 校验位不正确");
  return normalized;
}

export function normalizeUn(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  const digits = raw.replace(/^(UN|NA)/, "");
  if (!/^\d{4}$/.test(digits)) throw new Error("UN/NA 编号应包含 4 位数字");
  return `${raw.startsWith("NA") ? "NA" : "UN"}${digits}`;
}

export function pairKey(groupA, groupB) {
  const values = [String(groupA || "").trim(), String(groupB || "").trim()].sort();
  if (!values[0] || !values[1]) throw new Error("反应组 ID 不能为空");
  return `${values[0]}::${values[1]}`;
}

export function cartesianProduct(left = [], right = []) {
  return left.flatMap((a) => right.map((b) => [a, b]));
}

export function validateSourceRef(source, context = "来源") {
  const missing = SOURCE_FIELDS.filter((field) => !String(source?.[field] || "").trim());
  if (missing.length) throw new Error(`${context}缺少字段：${missing.join("、")}`);
  return true;
}

export function validateProductionData({ manifest, chemicals = [], groupPairs = [], directEvidence = [] }) {
  if (!manifest?.dataVersion || !manifest?.sourceMode || !manifest?.rightsGate) throw new Error("生产数据清单不完整");
  if (manifest.sourceMode === "approved_snapshot" && !manifest.rightsGate.productionChemicalDataApproved) {
    throw new Error("授权清单未批准，不能启用 approved_snapshot");
  }
  const records = [...chemicals, ...groupPairs, ...directEvidence];
  for (const record of records) {
    if (!Array.isArray(record.sourceRefs) || !record.sourceRefs.length) throw new Error(`${record.id || record.key || "记录"} 缺少来源`);
    record.sourceRefs.forEach((source) => validateSourceRef(source, record.id || record.key || "记录"));
    if (record.sourceRefs.some((source) => source.licenseClass === "TEST_ONLY")) throw new Error("TEST_ONLY 记录不得进入生产数据包");
  }
  if (manifest.sourceMode === "official_assist" && records.length) throw new Error("official_assist 模式不得捆绑生产化学品或组对记录");
  return true;
}

export function searchIdentityCandidates(query, records = []) {
  const name = normalizeName(query?.name ?? query);
  const cas = query?.cas ? normalizeCas(query.cas) : "";
  const un = query?.un ? normalizeUn(query.un) : "";
  if (!name && !cas && !un) return [];
  return records.filter((record) => {
    if (record.reviewStatus === "RETIRED") return false;
    if (cas && record.casNumber === cas) return true;
    if (un && (record.unNumbers || []).includes(un)) return true;
    const names = [record.preferredName, ...(record.searchableNames || [])].map(normalizeName);
    return name && names.some((candidate) => candidate.includes(name) || name.includes(candidate));
  });
}

export function resolveIdentity(query, records = []) {
  const candidates = searchIdentityCandidates(query, records);
  if (!candidates.length) return { status: "NOT_FOUND", candidates: [] };
  if (candidates.length > 1) return { status: "MULTIPLE", candidates };
  const record = candidates[0];
  if (!record.identityConfirmed || record.mixtureFlag && !record.concentrationNote) {
    return { status: "NEEDS_CONFIRMATION", candidates };
  }
  return { status: "CONFIRMED", record, candidates };
}

export function assertIdentityConfirmed(...records) {
  for (const record of records) {
    if (!record?.id || !record.identityConfirmed || record.reviewStatus === "RETIRED") {
      throw new Error("无法唯一确认化学品身份。请选择具体记录或补充 CAS、浓度、物态及最新版 SDS；系统不会用模糊匹配直接生成相容性结论。");
    }
    if (!record.sourceRefs?.length) throw new Error(`${record.preferredName || "化学品"} 缺少来源和版本`);
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classifyPair({ chemicalA, chemicalB, evidence = [], missingGroupPairs = [], uncertaintyFlags = [], sourceManifest }) {
  const direct = evidence.filter((item) => item.evidenceType === "DIRECT");
  const grouped = evidence.filter((item) => item.evidenceType === "GROUP_PAIR");
  const directStatuses = new Set(direct.map((item) => item.status));
  const groupStatuses = new Set(grouped.map((item) => item.status));
  const conflict = direct.length && grouped.length && [...directStatuses].some((status) => !groupStatuses.has(status));
  let status;
  if (conflict) status = STATUSES.CONFLICT_REVIEW;
  else if (evidence.some((item) => item.status === STATUSES.INCOMPATIBLE)) status = STATUSES.INCOMPATIBLE;
  else if (evidence.some((item) => item.status === STATUSES.CAUTION)) status = STATUSES.CAUTION;
  else if (missingGroupPairs.length || uncertaintyFlags.length || !evidence.length) status = STATUSES.UNKNOWN;
  else if (evidence.every((item) => item.status === STATUSES.NO_PREDICTED_HAZARD)) status = STATUSES.NO_PREDICTED_HAZARD;
  else status = STATUSES.UNKNOWN;

  const consequenceTags = [...new Set(evidence.flatMap((item) => item.consequenceTags || []))];
  const possibleGases = [...new Set(evidence.flatMap((item) => item.possibleGases || []))];
  const sourceRefs = uniqueBy(evidence.flatMap((item) => item.sourceRefs || []), (source) => `${source.sourceId}|${source.recordId || ""}|${source.version}`);
  const escalationReasons = [];
  consequenceTags.filter((tag) => ESCALATION_TAGS.has(tag)).forEach((tag) => escalationReasons.push(`后果标签 ${tag}`));
  if ([STATUSES.UNKNOWN, STATUSES.CONFLICT_REVIEW].includes(status)) escalationReasons.push(status === STATUSES.UNKNOWN ? "资料不足或组对缺口" : "直接资料与反应组预测冲突");
  return {
    chemicalA: { id: chemicalA.id, name: chemicalA.preferredName },
    chemicalB: { id: chemicalB.id, name: chemicalB.preferredName },
    status,
    statusMeta: STATUS_META[status],
    evidence,
    consequenceTags,
    possibleGases,
    missingGroupPairs,
    uncertaintyFlags,
    sourceRefs,
    sourceManifest: { dataVersion: sourceManifest?.dataVersion || "unknown", sourceMode: sourceManifest?.sourceMode || "unknown" },
    escalateProcessSafety: escalationReasons.length > 0,
    escalationReasons,
    disclaimer: status === STATUSES.NO_PREDICTED_HAZARD ? "当前数据与规则未预测到该二元组合的危险反应；这不等于相容、安全或允许混合。" : "本结果用于筛查和证据整理，不代表安全批准。"
  };
}

export function predictChemicalPair(a, b, { groupPairs = [], directEvidence = [], sourceManifest = {} } = {}) {
  assertIdentityConfirmed(a, b);
  const direct = directEvidence.filter((item) => {
    const ids = [item.chemicalAId, item.chemicalBId].sort();
    return ids[0] === [a.id, b.id].sort()[0] && ids[1] === [a.id, b.id].sort()[1];
  }).map((item) => ({ ...item, evidenceType: "DIRECT" }));
  const lookup = new Map(groupPairs.map((rule) => [pairKey(rule.groupA, rule.groupB), rule]));
  const combinations = cartesianProduct(a.reactiveGroupIds || [], b.reactiveGroupIds || []);
  const groupEvidence = [];
  const missingGroupPairs = [];
  combinations.forEach(([groupA, groupB]) => {
    const key = pairKey(groupA, groupB);
    const rule = lookup.get(key);
    if (rule) groupEvidence.push({ ...rule, key, evidenceType: "GROUP_PAIR" });
    else missingGroupPairs.push(key);
  });
  const uncertaintyFlags = [];
  if (!(a.reactiveGroupIds || []).length) uncertaintyFlags.push(`${a.preferredName} 缺少反应组`);
  if (!(b.reactiveGroupIds || []).length) uncertaintyFlags.push(`${b.preferredName} 缺少反应组`);
  if (a.mixtureFlag && !a.concentrationNote) uncertaintyFlags.push(`${a.preferredName} 的混合物组成或浓度未知`);
  if (b.mixtureFlag && !b.concentrationNote) uncertaintyFlags.push(`${b.preferredName} 的混合物组成或浓度未知`);
  return classifyPair({ chemicalA: a, chemicalB: b, evidence: [...direct, ...groupEvidence], missingGroupPairs, uncertaintyFlags, sourceManifest });
}

export function buildCompatibilityMatrix(chemicals = [], data = {}) {
  chemicals.forEach((chemical) => assertIdentityConfirmed(chemical));
  const cells = chemicals.map((row, i) => chemicals.map((column, j) => {
    if (i === j) return { status: STATUSES.NOT_APPLICABLE, statusMeta: STATUS_META.NOT_APPLICABLE, chemicalA: { id: row.id, name: row.preferredName }, chemicalB: { id: column.id, name: column.preferredName } };
    if (j < i) return null;
    return predictChemicalPair(row, column, data);
  }));
  for (let i = 0; i < chemicals.length; i += 1) {
    for (let j = 0; j < i; j += 1) cells[i][j] = cells[j][i];
  }
  return cells;
}

export function summarizeMatrix(matrix = []) {
  const counts = Object.fromEntries(Object.keys(STATUSES).map((status) => [status, 0]));
  const pairs = [];
  matrix.forEach((row, i) => row.forEach((cell, j) => {
    if (j <= i) return;
    counts[cell.status] += 1;
    pairs.push(cell);
  }));
  return { counts, pairs };
}

export function deriveStorageActions(result) {
  const actions = [];
  if ([STATUSES.INCOMPATIBLE, STATUSES.CONFLICT_REVIEW].includes(result.status)) actions.push("禁止同柜、同托盘或同一二次围堰，直至合格人员完成复核");
  if ([STATUSES.CAUTION, STATUSES.UNKNOWN].includes(result.status)) actions.push("保持隔离并补充最新版 SDS、浓度、物态和反应性证据");
  if (result.consequenceTags?.some((tag) => ["GENERATES_GAS", "PRESSURIZATION"].includes(tag))) actions.push("防止共用排液、转移软管及密闭空间交叉接触");
  actions.push("按 GB 15603—2022、最新版 SDS 和企业制度由合格人员最终确定储存方案");
  return [...new Set(actions)];
}

export function createUserDraftRecord(input = {}) {
  const name = String(input.preferredName || "").trim();
  if (!name) throw new Error("请输入 SDS 上的化学品或商品名称");
  const mixtureFlag = Boolean(input.mixtureFlag);
  const concentrationNote = String(input.concentrationNote || "").trim();
  const sourceVersion = String(input.sdsVersion || "").trim();
  if (!sourceVersion) throw new Error("请填写 SDS 版本或发布日期");
  if (mixtureFlag && !concentrationNote) throw new Error("混合物必须填写组成、浓度或配方识别信息后才能确认身份");
  const casNumber = input.casNumber ? normalizeCas(input.casNumber) : undefined;
  const unNumbers = String(input.unNumber || "").trim() ? [normalizeUn(input.unNumber)] : [];
  return {
    id: `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    preferredName: name,
    searchableNames: [],
    casNumber,
    unNumbers,
    substanceForm: String(input.substanceForm || "").trim(),
    concentrationNote,
    mixtureFlag,
    reactiveGroupIds: String(input.reactiveGroupIds || "").split(/[,，;；\n]/).map((value) => value.trim()).filter(Boolean),
    directIncompatibilities: String(input.directIncompatibilities || "").split(/[,，;；\n]/).map((value) => value.trim()).filter(Boolean),
    reactivityAlerts: String(input.reactivityAlerts || "").split(/\n/).map((value) => value.trim()).filter(Boolean),
    sourceRefs: [{ sourceId: "USER_SDS", recordId: String(input.supplier || "").trim() || undefined, title: `用户录入 SDS：${name}`, version: sourceVersion, reviewedAt: new Date().toISOString().slice(0, 10), licenseClass: "USER_PROVIDED_LOCAL_ONLY" }],
    reviewStatus: "DRAFT",
    evidenceLayer: "用户草稿，未复核",
    identityConfirmed: Boolean(input.identityConfirmed)
  };
}

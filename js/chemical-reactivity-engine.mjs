export const STATUSES = Object.freeze({
  INCOMPATIBLE: "INCOMPATIBLE", CAUTION: "CAUTION", NO_PREDICTED_HAZARD: "NO_PREDICTED_HAZARD",
  UNKNOWN: "UNKNOWN", CONFLICT_REVIEW: "CONFLICT_REVIEW"
});
export const INTRINSIC_STATUSES = Object.freeze({ SELF_REACTIVE: "SELF_REACTIVE", NO_SELF_REACTION_IDENTIFIED: "NO_SELF_REACTION_IDENTIFIED", UNKNOWN: "UNKNOWN" });
export const STATUS_META = Object.freeze({
  INCOMPATIBLE: { label: "不相容", icon: "⛔", sourceCode: "N" },
  CAUTION: { label: "谨慎，需进一步核实", icon: "⚠", sourceCode: "C" },
  NO_PREDICTED_HAZARD: { label: "未预测到两两不相容", icon: "ⓘ", sourceCode: "Y" },
  UNKNOWN: { label: "资料不足 / 未知", icon: "?", sourceCode: "?" },
  CONFLICT_REVIEW: { label: "数据冲突，人工复核", icon: "◆", sourceCode: "?" },
  SELF_REACTIVE: { label: "潜在自反应", icon: "SR", sourceCode: "SR" },
  NO_SELF_REACTION_IDENTIFIED: { label: "未识别出自反应", icon: "X", sourceCode: "X" }
});

export const CRW_REFERENCE_SCENARIO = Object.freeze({
  id: "CRW-REFERENCE-35C-24H", mode: "CRW_REFERENCE", name: "CRW 默认参考情景",
  temperatureMaxC: 35, pressureNote: "绝热但非气密容器；可能自由泄压", insulatedVessel: true,
  airtightVessel: false, durationHours: 24, ratioNote: "两种化学品混合；比例未限定",
  waterPresent: false, airPresent: true, catalystOrImpurityNote: "未特别考虑催化剂、杂质或稳定剂变化",
  additionOrderNote: "未模拟具体加料顺序或搅拌状态",
  sourceRefs: [{ sourceId: "AICHE_CRW_SCENARIO", title: "CRW4 reference mixing scenario", version: "4.0.3", reviewedAt: "2026-08-30", licenseClass: "METHOD_DESCRIPTION_ONLY" }]
});

const SOURCE_FIELDS = ["sourceId", "title", "version", "reviewedAt", "licenseClass"];
const ESCALATION_TAGS = new Set(["GENERATES_HEAT", "GENERATES_GAS", "PRESSURIZATION", "INTENSE_OR_EXPLOSIVE", "FIRE_RISK", "FLAMMABLE_GAS", "TOXIC_PRODUCT", "CORROSIVE_PRODUCT", "POLYMERIZATION", "DECOMPOSITION", "WATER_REACTIVE", "AIR_REACTIVE", "CATALYTIC_EFFECT"]);

export function normalizeName(value) { return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase(); }
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
export function chemicalPairKey(chemicalAId, chemicalBId) {
  const values = [String(chemicalAId || "").trim(), String(chemicalBId || "").trim()].sort();
  if (!values[0] || !values[1]) throw new Error("化学品记录 ID 不能为空");
  return `${values[0]}::${values[1]}`;
}
export function cartesianProduct(left = [], right = []) { return left.flatMap((a) => right.map((b) => [a, b])); }
export function validateSourceRef(source, context = "来源") {
  const missing = SOURCE_FIELDS.filter((field) => !String(source?.[field] || "").trim());
  if (missing.length) throw new Error(`${context}缺少字段：${missing.join("、")}`);
  return true;
}
export function validateProductionData({ manifest, chemicals = [], groupPairs = [], directEvidence = [], mixingScenarios = [] }) {
  if (!manifest?.dataVersion || !manifest?.sourceMode || !manifest?.rightsGate) throw new Error("生产数据清单不完整");
  if (manifest.sourceMode === "approved_snapshot" && !manifest.rightsGate.productionChemicalDataApproved) throw new Error("授权清单未批准，不能启用 approved_snapshot");
  const records = [...chemicals, ...groupPairs, ...directEvidence, ...mixingScenarios];
  for (const record of records) {
    if (!Array.isArray(record.sourceRefs) || !record.sourceRefs.length) throw new Error(`${record.id || record.key || "记录"} 缺少来源`);
    record.sourceRefs.forEach((source) => validateSourceRef(source, record.id || record.key || "记录"));
    if (record.sourceRefs.some((source) => source.licenseClass === "TEST_ONLY")) throw new Error("TEST_ONLY 记录不得进入生产数据包");
  }
  if (manifest.sourceMode === "official_assist" && [...chemicals, ...groupPairs, ...directEvidence].length) throw new Error("official_assist 模式不得捆绑生产化学品或组对记录");
  return true;
}

function matchesName(candidate, query, mode) {
  if (!query) return false;
  if (mode === "exact") return candidate === query;
  if (mode === "starts_with") return candidate.startsWith(query);
  return candidate.includes(query);
}
export function searchIdentityCandidates(query, records = [], mode = "exact") {
  const name = normalizeName(query?.name ?? query);
  const cas = query?.cas ? normalizeCas(query.cas) : "";
  const un = query?.un ? normalizeUn(query.un) : "";
  const searchMode = ["exact", "starts_with", "contains"].includes(query?.mode) ? query.mode : mode;
  if (!name && !cas && !un) return [];
  return records.filter((record) => {
    if (record.reviewStatus === "RETIRED" || record.archivedAt) return false;
    if (cas && record.casNumber === cas) return true;
    if (un && (record.unNumbers || []).includes(un)) return true;
    return name && [record.preferredName, ...(record.searchableNames || [])].map(normalizeName).some((candidate) => matchesName(candidate, name, searchMode));
  });
}
export function resolveIdentity(query, records = [], mode = "exact") {
  const candidates = searchIdentityCandidates(query, records, mode);
  if (!candidates.length) return { status: "NOT_FOUND", candidates: [] };
  if (candidates.length > 1) return { status: "MULTIPLE", candidates };
  const record = candidates[0];
  if (!record.identityConfirmed || record.mixtureFlag && !record.concentrationNote) return { status: "NEEDS_CONFIRMATION", candidates };
  return { status: "CONFIRMED", record, candidates };
}
export function assertIdentityConfirmed(...records) {
  for (const record of records) {
    if (!record?.id || !record.identityConfirmed || record.reviewStatus === "RETIRED" || record.archivedAt) throw new Error("无法唯一确认化学品身份。请选择具体记录或补充 CAS、浓度、物态及最新版 SDS；系统不会用模糊匹配直接生成相容性结论。");
    if (!record.sourceRefs?.length) throw new Error(`${record.preferredName || "化学品"} 缺少来源和版本`);
  }
}
function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => { const key = keyFn(item); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function createCustomScenario(input = {}) {
  const scenario = {
    id: input.id || `SCENARIO-${Date.now()}`, mode: "CUSTOM", name: String(input.name || "用户自定义情景").trim(),
    temperatureMaxC: input.temperatureMaxC === "" || input.temperatureMaxC == null ? undefined : Number(input.temperatureMaxC),
    pressureNote: String(input.pressureNote || "").trim(), insulatedVessel: Boolean(input.insulatedVessel), airtightVessel: Boolean(input.airtightVessel),
    durationHours: input.durationHours === "" || input.durationHours == null ? undefined : Number(input.durationHours), ratioNote: String(input.ratioNote || "").trim(),
    waterPresent: Boolean(input.waterPresent), airPresent: Boolean(input.airPresent), catalystOrImpurityNote: String(input.catalystOrImpurityNote || "").trim(),
    additionOrderNote: String(input.additionOrderNote || "").trim(),
    sourceRefs: [{ sourceId: "USER_SCENARIO", title: "用户自定义评估情景", version: "local-v1", reviewedAt: new Date().toISOString().slice(0, 10), licenseClass: "USER_PROVIDED_LOCAL_ONLY" }]
  };
  if (!scenario.name) throw new Error("请填写情景名称");
  if (!Number.isFinite(scenario.temperatureMaxC) || !Number.isFinite(scenario.durationHours)) throw new Error("自定义情景必须填写有效的最高温度和接触/储存时间");
  return scenario;
}
export function compareWithSourceScenario(scenario = CRW_REFERENCE_SCENARIO) {
  if (scenario.mode === "CRW_REFERENCE") return [];
  const warnings = [];
  if (scenario.temperatureMaxC > 35) warnings.push(`最高温度 ${scenario.temperatureMaxC}°C 超出 CRW 参考情景约 35°C`);
  if (scenario.airtightVessel) warnings.push("情景包含气密或可能密闭升压条件");
  if (!scenario.insulatedVessel) warnings.push("容器热边界与 CRW 参考情景不同");
  if (scenario.durationHours > 24) warnings.push(`接触/储存 ${scenario.durationHours} 小时超过参考情景的少于 1 天`);
  if (scenario.catalystOrImpurityNote) warnings.push("情景包含催化剂、杂质或稳定剂变化，两两规则可能无法覆盖");
  if (scenario.additionOrderNote) warnings.push("情景指定了加料或搅拌条件，来源规则未模拟其动态影响");
  return warnings;
}
export function classifyIntrinsicSelfReactivity(record) {
  const status = Object.values(INTRINSIC_STATUSES).includes(record.selfReactivityStatus) ? record.selfReactivityStatus : INTRINSIC_STATUSES.UNKNOWN;
  return { cellKind: "INTRINSIC", chemicalA: { id: record.id, name: record.preferredName }, chemicalB: { id: record.id, name: record.preferredName }, status, predictedStatus: status, displayedStatus: status, sourceCode: STATUS_META[status].sourceCode, statusMeta: STATUS_META[status], sourceRefs: record.sourceRefs || [], evidence: record.reactivityAlerts || [], disclaimer: status === INTRINSIC_STATUSES.NO_SELF_REACTION_IDENTIFIED ? "当前资料未识别出自反应，不表示所有条件下稳定。" : "固有反应性结论需结合温度、杂质、稳定剂、时间和尺度复核。" };
}

export function classifyPair({ chemicalA, chemicalB, evidence = [], missingGroupPairs = [], uncertaintyFlags = [], sourceManifest, scenario = CRW_REFERENCE_SCENARIO }) {
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
  const scenarioWarnings = compareWithSourceScenario(scenario);
  const escalationReasons = [];
  consequenceTags.filter((tag) => ESCALATION_TAGS.has(tag)).forEach((tag) => escalationReasons.push(`后果标签 ${tag}`));
  if ([STATUSES.UNKNOWN, STATUSES.CONFLICT_REVIEW].includes(status)) escalationReasons.push(status === STATUSES.UNKNOWN ? "资料不足或组对缺口" : "直接资料与反应组预测冲突");
  escalationReasons.push(...scenarioWarnings);
  return {
    cellKind: "PAIR", pairKey: chemicalPairKey(chemicalA.id, chemicalB.id), chemicalA: { id: chemicalA.id, name: chemicalA.preferredName }, chemicalB: { id: chemicalB.id, name: chemicalB.preferredName },
    status, predictedStatus: status, displayedStatus: status, sourceCode: STATUS_META[status].sourceCode, statusMeta: STATUS_META[status], evidence, consequenceTags, possibleGases,
    missingGroupPairs, uncertaintyFlags, sourceRefs, sourceManifest: { dataVersion: sourceManifest?.dataVersion || "unknown", sourceMode: sourceManifest?.sourceMode || "unknown" },
    scenario: structuredClone(scenario), scenarioWarnings, escalateProcessSafety: escalationReasons.length > 0, escalationReasons,
    detailSections: { hazardSummary: consequenceTags, potentialGases: possibleGases, documentation: evidence, pairComments: [] },
    disclaimer: status === STATUSES.NO_PREDICTED_HAZARD ? "当前数据与规则未预测到该二元组合的危险反应；这不等于相容、安全或允许混合。" : "本结果用于筛查和证据整理，不代表安全批准。"
  };
}
export function predictChemicalPair(a, b, { groupPairs = [], directEvidence = [], sourceManifest = {}, scenario = CRW_REFERENCE_SCENARIO } = {}) {
  assertIdentityConfirmed(a, b);
  const targetPairKey = chemicalPairKey(a.id, b.id);
  const direct = directEvidence.filter((item) => chemicalPairKey(item.chemicalAId, item.chemicalBId) === targetPairKey).map((item) => ({ ...item, evidenceType: "DIRECT" }));
  const lookup = new Map(groupPairs.map((rule) => [pairKey(rule.groupA, rule.groupB), rule]));
  const combinations = cartesianProduct(a.reactiveGroupIds || [], b.reactiveGroupIds || []);
  const groupEvidence = [], missingGroupPairs = [];
  combinations.forEach(([groupA, groupB]) => { const key = pairKey(groupA, groupB); const rule = lookup.get(key); if (rule) groupEvidence.push({ ...rule, key, evidenceType: "GROUP_PAIR" }); else missingGroupPairs.push(key); });
  const uncertaintyFlags = [];
  if (!(a.reactiveGroupIds || []).length) uncertaintyFlags.push(`${a.preferredName} 缺少反应组`);
  if (!(b.reactiveGroupIds || []).length) uncertaintyFlags.push(`${b.preferredName} 缺少反应组`);
  if (a.mixtureFlag && !a.concentrationNote) uncertaintyFlags.push(`${a.preferredName} 的混合物组成或浓度未知`);
  if (b.mixtureFlag && !b.concentrationNote) uncertaintyFlags.push(`${b.preferredName} 的混合物组成或浓度未知`);
  if (a.recordKind === "REACTIVE_GROUP_PROXY" || b.recordKind === "REACTIVE_GROUP_PROXY") uncertaintyFlags.push("包含反应组代理：结果仅为组级推断，不是具体化学品结论");
  return classifyPair({ chemicalA: a, chemicalB: b, evidence: [...direct, ...groupEvidence], missingGroupPairs, uncertaintyFlags, sourceManifest, scenario });
}
export function buildCompatibilityMatrix(chemicals = [], data = {}) {
  chemicals.forEach((chemical) => assertIdentityConfirmed(chemical));
  const cells = chemicals.map((row, i) => chemicals.map((column, j) => i === j ? classifyIntrinsicSelfReactivity(row) : j < i ? null : predictChemicalPair(row, column, data)));
  for (let i = 0; i < chemicals.length; i += 1) for (let j = 0; j < i; j += 1) cells[i][j] = cells[j][i];
  return cells;
}
export function matrixViewCells(matrix = [], view = "lower") {
  const cells = [];
  matrix.forEach((row, i) => row.forEach((cell, j) => { if (view === "lower" && j > i) return; if (view === "anomalies" && (i === j || cell.status === STATUSES.NO_PREDICTED_HAZARD)) return; cells.push({ i, j, cell }); }));
  return cells;
}
export function summarizeMatrix(matrix = []) {
  const counts = Object.fromEntries(Object.keys(STATUSES).map((status) => [status, 0]));
  const intrinsicCounts = Object.fromEntries(Object.keys(INTRINSIC_STATUSES).map((status) => [status, 0]));
  const pairs = [], intrinsic = [];
  matrix.forEach((row, i) => row.forEach((cell, j) => { if (i === j) { intrinsicCounts[cell.status] += 1; intrinsic.push(cell); } else if (j > i) { counts[cell.status] += 1; pairs.push(cell); } }));
  return { counts, intrinsicCounts, pairs, intrinsic };
}

export function createPairOverride(input = {}) {
  if (!input.pairKey || !Object.values(STATUSES).includes(input.predictedStatus) || !Object.values(STATUSES).includes(input.revisedStatus)) throw new Error("人工修订缺少有效组合或状态");
  if (!String(input.reason || "").trim()) throw new Error("人工修订必须填写理由");
  if (!Array.isArray(input.evidenceRefs) || !input.evidenceRefs.length) throw new Error("人工修订必须提供证据来源");
  input.evidenceRefs.forEach((source) => validateSourceRef(source, "人工修订证据"));
  if (input.predictedStatus === STATUSES.UNKNOWN && input.revisedStatus === STATUSES.NO_PREDICTED_HAZARD && !input.reviewedBy) throw new Error("UNKNOWN 不能在未批准时修订为未预测到危险");
  return { id: input.id || `OVERRIDE-${Date.now()}`, pairKey: input.pairKey, predictedStatus: input.predictedStatus, revisedStatus: input.revisedStatus, reason: String(input.reason).trim(), evidenceRefs: input.evidenceRefs, scenarioId: input.scenarioId, ruleVersion: input.ruleVersion, dataVersion: input.dataVersion, createdBy: String(input.createdBy || "本地用户").trim(), createdAt: input.createdAt || new Date().toISOString(), reviewedBy: input.reviewedBy, reviewedAt: input.reviewedAt, status: input.reviewedBy ? "APPROVED" : "DRAFT" };
}
export function reviewPairOverride(override, reviewer) {
  if (!String(reviewer || "").trim()) throw new Error("第二复核人不能为空");
  if (String(reviewer).trim() === override.createdBy) throw new Error("人工修订必须由第二人复核");
  return { ...override, reviewedBy: String(reviewer).trim(), reviewedAt: new Date().toISOString(), status: "APPROVED" };
}
export function invalidateStaleOverrides(overrides = [], { ruleVersion, dataVersion } = {}) { return overrides.map((override) => override.ruleVersion !== ruleVersion || override.dataVersion !== dataVersion ? { ...override, status: "SUPERSEDED", staleReason: "规则或数据版本已变化，需要重新复核" } : override); }
export function applyPairOverride(result, override) {
  if (!override || override.pairKey !== result.pairKey) return result;
  const displayedStatus = override.status === "APPROVED" ? override.revisedStatus : result.predictedStatus;
  return { ...result, displayedStatus, status: displayedStatus, statusMeta: STATUS_META[displayedStatus], overrideId: override.id, overrideMarker: "*", override, detailSections: { ...result.detailSections, pairComments: [...(result.detailSections?.pairComments || []), override] } };
}
export function deriveStorageActions(result) {
  const actions = [];
  if ([STATUSES.INCOMPATIBLE, STATUSES.CONFLICT_REVIEW].includes(result.status)) actions.push("禁止同柜、同托盘或同一二次围堰，直至合格人员完成复核");
  if ([STATUSES.CAUTION, STATUSES.UNKNOWN].includes(result.status)) actions.push("保持隔离并补充最新版 SDS、浓度、物态和反应性证据");
  if (result.consequenceTags?.some((tag) => ["GENERATES_GAS", "PRESSURIZATION"].includes(tag))) actions.push("防止共用排液、转移软管及密闭空间交叉接触");
  actions.push("按 GB 15603—2022、最新版 SDS 和企业制度由合格人员最终确定储存方案");
  return [...new Set(actions)];
}

function userSource(name, input) {
  const version = String(input.sdsVersion || input.sourceVersion || "").trim();
  if (!version) throw new Error("请填写 SDS/证据版本或发布日期");
  return [{ sourceId: input.sourceId || "USER_SDS", recordId: String(input.supplier || "").trim() || undefined, title: `用户录入证据：${name}`, version, reviewedAt: new Date().toISOString().slice(0, 10), licenseClass: "USER_PROVIDED_LOCAL_ONLY" }];
}
export function createUserDraftRecord(input = {}) {
  const name = String(input.preferredName || "").trim();
  if (!name) throw new Error("请输入 SDS 上的化学品或商品名称");
  const mixtureFlag = Boolean(input.mixtureFlag), concentrationNote = String(input.concentrationNote || "").trim();
  if (mixtureFlag && !concentrationNote) throw new Error("混合物必须填写组成、浓度或配方识别信息后才能确认身份");
  const reactiveGroupIds = Array.isArray(input.reactiveGroupIds) ? input.reactiveGroupIds : String(input.reactiveGroupIds || "").split(/[,，;；\n]/).map((value) => value.trim()).filter(Boolean);
  const now = new Date().toISOString();
  return { id: input.id || `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, preferredName: name, searchableNames: [], casNumber: input.casNumber ? normalizeCas(input.casNumber) : undefined, unNumbers: String(input.unNumber || "").trim() ? [normalizeUn(input.unNumber)] : [], substanceForm: String(input.substanceForm || "").trim(), concentrationNote, mixtureFlag, reactiveGroupIds, recordKind: input.recordKind || "CUSTOM_CHEMICAL", directIncompatibilities: String(input.directIncompatibilities || "").split(/[,，;；\n]/).map((value) => value.trim()).filter(Boolean), reactivityAlerts: String(input.reactivityAlerts || "").split(/\n/).map((value) => value.trim()).filter(Boolean), selfReactivityStatus: input.selfReactivityStatus || INTRINSIC_STATUSES.UNKNOWN, sourceRefs: userSource(name, input), reviewStatus: "DRAFT", evidenceLayer: "用户草稿，未复核", identityConfirmed: Boolean(input.identityConfirmed), createdBy: String(input.createdBy || "本地用户"), createdAt: now, history: [{ action: "CREATED", at: now }] };
}
export function approveCustomChemical(record, reviewer) {
  if (!(record.reactiveGroupIds || []).length) throw new Error("自定义化学品至少需要一个经人工确认的反应组");
  if (!(record.sourceRefs || []).length) throw new Error("自定义化学品缺少证据来源");
  if (!String(reviewer || "").trim()) throw new Error("复核人不能为空");
  const at = new Date().toISOString();
  return { ...record, reviewStatus: "APPROVED", reviewedBy: String(reviewer).trim(), reviewedAt: at, history: [...(record.history || []), { action: "APPROVED", at, by: String(reviewer).trim() }] };
}
export function createReactiveGroupProxy(input = {}) {
  const groupIds = Array.isArray(input.reactiveGroupIds) ? input.reactiveGroupIds.filter(Boolean) : [String(input.reactiveGroupId || "").trim()].filter(Boolean);
  if (!groupIds.length) throw new Error("请选择至少一个反应组并确认仅进行组级筛查");
  return createUserDraftRecord({ ...input, preferredName: `反应组代理：${String(input.preferredName || groupIds.join(" + ")).trim()}`, reactiveGroupIds: groupIds, recordKind: "REACTIVE_GROUP_PROXY", identityConfirmed: true, substanceForm: "组级代理，非已确认化学品" });
}
export function createQuickWaterRecord(approvedWaterRecord) {
  if (approvedWaterRecord?.identityConfirmed) return { ...approvedWaterRecord };
  const now = new Date().toISOString(), date = now.slice(0, 10);
  return { id: `LOCAL-WATER-${Date.now()}`, preferredName: "水（本地占位，待关联获准反应组）", searchableNames: ["water", "水"], mixtureFlag: false, reactiveGroupIds: [], recordKind: "CUSTOM_CHEMICAL", directIncompatibilities: [], reactivityAlerts: ["未关联经授权反应组；所有两两结果保持 UNKNOWN。"], selfReactivityStatus: INTRINSIC_STATUSES.NO_SELF_REACTION_IDENTIFIED, sourceRefs: [{ sourceId: "EHS_SIL_LOCAL_WORKFLOW", title: "快速加入水占位工作流", version: "v2.1", reviewedAt: date, licenseClass: "WORKFLOW_ONLY_NO_REACTIVITY_DATA" }], reviewStatus: "DRAFT", evidenceLayer: "用户草稿，未复核", identityConfirmed: true, createdBy: "本地用户", createdAt: now, history: [{ action: "QUICK_WATER_PLACEHOLDER_CREATED", at: now }] };
}

export function createProject(input = {}) {
  const now = new Date().toISOString(), name = String(input.name || "临时混合体系").trim();
  if (!name) throw new Error("项目名称不能为空");
  return { id: input.id || `PROJECT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, site: String(input.site || "").trim(), createdBy: String(input.createdBy || "本地用户").trim(), reviewedBy: String(input.reviewedBy || "").trim(), createdAt: input.createdAt || now, updatedAt: now, lastReviewedAt: input.lastReviewedAt || "", status: "DRAFT", archivedAt: null, componentIds: [...new Set(input.componentIds || [])], scenario: input.scenario ? structuredClone(input.scenario) : structuredClone(CRW_REFERENCE_SCENARIO), notes: String(input.notes || "").trim(), version: Number(input.version || 1), history: [{ action: "CREATED", at: now }] };
}
export function duplicateProject(project) { return createProject({ ...project, id: undefined, name: `${project.name}（副本）`, version: 1, createdAt: undefined }); }
export function archiveProject(project) { const at = new Date().toISOString(); return { ...project, status: "ARCHIVED", archivedAt: at, updatedAt: at, history: [...(project.history || []), { action: "ARCHIVED", at }] }; }
export function updateProject(project, patch = {}) { const at = new Date().toISOString(); return { ...project, ...patch, id: project.id, version: project.version + 1, updatedAt: at, history: [...(project.history || []), { action: "UPDATED", at }] }; }

const COLORS = { navy: "0D2836", white: "FFFFFF", line: "D8D4CB", red: "FDE8E7", amber: "FFF4CE", gray: "EEF1F2", purple: "F1E8F6", green: "E8F5EC", orange: "FCE8D6" };
const STATUS_FILLS = { INCOMPATIBLE: COLORS.red, CAUTION: COLORS.amber, UNKNOWN: COLORS.gray, CONFLICT_REVIEW: COLORS.purple, NO_PREDICTED_HAZARD: COLORS.green, SELF_REACTIVE: COLORS.orange, NO_SELF_REACTION_IDENTIFIED: COLORS.gray };
function safe(value) { return value == null ? "" : String(value); }
function join(values) { return (values || []).filter(Boolean).join("；"); }
function scenarioText(scenario = {}) {
  return join([`类型：${scenario.mode === "CRW_REFERENCE" ? "CRW 默认参考情景" : "用户自定义"}`, `名称：${scenario.name || "未命名"}`, Number.isFinite(scenario.temperatureMaxC) ? `最高温度：${scenario.temperatureMaxC}°C` : "最高温度：未提供", `容器：${scenario.insulatedVessel ? "绝热" : "非绝热/未知"}、${scenario.airtightVessel ? "气密/可能密闭升压" : "非气密"}`, Number.isFinite(scenario.durationHours) ? `接触/储存：${scenario.durationHours} 小时` : "接触/储存时间：未提供", scenario.pressureNote, scenario.ratioNote, scenario.catalystOrImpurityNote, scenario.additionOrderNote]);
}
function sourceText(source) { return `${source.sourceId}/${source.recordId || "-"}/${source.version}`; }
function styleHeader(row) {
  row.eachCell((cell) => { cell.font = { name: "Microsoft YaHei", bold: true, color: { argb: COLORS.white } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; });
}
function styleRows(sheet) {
  sheet.eachRow((row, index) => { if (index === 1) return; row.eachCell((cell) => { cell.font = { name: "Microsoft YaHei", size: 9 }; cell.alignment = { vertical: "top", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: COLORS.line } } }; }); });
}
function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  sheet.columns = columns; styleHeader(sheet.getRow(1)); rows.forEach((values) => sheet.addRow(values)); styleRows(sheet);
  const end = String.fromCharCode(64 + Math.min(columns.length, 26));
  sheet.autoFilter = { from: "A1", to: `${end}1` }; sheet.headerFooter.oddHeader = "筛查工具，不等于安全批准"; sheet.headerFooter.oddFooter = "EHS-SIL｜第 &P / &N 页";
  return sheet;
}

export function buildReactivityWorkbook(ExcelJS, payload = {}) {
  if (!ExcelJS?.Workbook) throw new Error("ExcelJS 不可用");
  const workbook = new ExcelJS.Workbook(); workbook.creator = "EHS-SIL"; workbook.created = new Date();
  const records = payload.records || [], pairs = payload.summary?.pairs || [], intrinsic = payload.summary?.intrinsic || [], manifest = payload.manifest || {};
  const project = payload.project || {}, scenario = payload.scenario || project.scenario || {}, overrides = payload.overrides || [], now = new Date().toISOString();
  addSheet(workbook, "说明与限制", [{ header: "项目", width: 24 }, { header: "内容", width: 100 }], [
    ["文件定位", "化学品反应性筛查与证据整理，不代表相容、安全、允许混合或工程批准。"],
    ["项目 / 场所", join([project.name || "临时矩阵", project.site])], ["矩阵名称", project.matrixName || project.name || "化学品反应与禁忌矩阵"],
    ["创建人 / 日期", join([project.createdBy, project.createdAt])], ["复核人 / 最后复核", join([project.reviewedBy, project.lastReviewedAt])],
    ["当前评估情景", scenarioText(scenario)], ["算法限制", "矩阵只展开二元组合，不预测三元协同、催化效应、实际投料顺序或工艺尺度影响。"],
    ["CRW 来源代码", "N=不相容；C=谨慎；Y=未预测到两两不相容；SR=潜在自反应；X=未识别出自反应；*=人工修订；?=资料不足。"],
    ["规则版本", payload.ruleVersion || ""], ["参考工具版本", payload.referenceToolVersion || "CRW 4.0.3"], ["EHS-SIL 数据包版本", safe(manifest.dataVersion)], ["来源模式", safe(manifest.sourceMode)], ["生成时间", now],
    ["人工修订", `共 ${overrides.length} 条；待复核 ${overrides.filter((item) => item.status === "DRAFT").length} 条。`],
    ["复核要求", "结合实际浓度、温度、压力、杂质、稳定剂、设备材质、最新版 SDS、GB 15603—2022 和企业制度复核。"]
  ]);
  addSheet(workbook, "化学品主表", [
    { header: "记录ID", width: 24 }, { header: "名称", width: 32 }, { header: "记录类型", width: 20 }, { header: "CAS", width: 16 }, { header: "UN/NA", width: 16 }, { header: "形态/浓度", width: 28 }, { header: "反应组", width: 32 }, { header: "固有反应性", width: 20 }, { header: "证据层级", width: 22 }, { header: "来源版本", width: 36 }
  ], records.map((record) => [record.id, record.preferredName, record.recordKind || "CHEMICAL", record.casNumber, join(record.unNumbers), join([record.substanceForm, record.concentrationNote]), join(record.reactiveGroupIds), record.selfReactivityStatus || "UNKNOWN", record.evidenceLayer, join(record.sourceRefs?.map(sourceText))]));

  const matrixSheet = workbook.addWorksheet("两两相容矩阵", { views: [{ state: "frozen", xSplit: 1, ySplit: 1, showGridLines: false }] });
  matrixSheet.addRow(["化学品", ...records.map((record) => record.preferredName)]); styleHeader(matrixSheet.getRow(1));
  records.forEach((record, i) => {
    const row = matrixSheet.addRow([record.preferredName, ...(payload.matrix?.[i] || []).map((cell, j) => j > i ? "" : `${cell.sourceCode || "?"}${cell.overrideMarker || ""}`)]);
    (payload.matrix?.[i] || []).forEach((cell, j) => {
      if (j > i) return;
      const target = row.getCell(j + 2); target.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILLS[cell.status] || COLORS.gray } };
      const evidence = cell.cellKind === "INTRINSIC" ? join(cell.evidence) : join([...(cell.consequenceTags || []), ...(cell.possibleGases || []), ...(cell.evidence || []).map((item) => item.summary), ...(cell.missingGroupPairs || [])]);
      target.note = { texts: [{ font: { bold: true }, text: `${cell.statusMeta?.label || cell.status}\n` }, { text: `${evidence || "无已批准具体证据"}\n来源：${join((cell.sourceRefs || []).map(sourceText)) || "暂无"}` }] };
    });
  });
  matrixSheet.getColumn(1).width = 30; for (let i = 2; i <= records.length + 1; i += 1) matrixSheet.getColumn(i).width = 18; styleRows(matrixSheet); matrixSheet.headerFooter.oddHeader = "筛查工具，不等于安全批准";

  const detailColumns = [{ header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "来源代码", width: 12 }, { header: "状态", width: 22 }, { header: "后果标签", width: 34 }, { header: "可能气体", width: 32 }, { header: "证据/缺口", width: 60 }, { header: "来源", width: 42 }, { header: "评估情景", width: 60 }];
  const detailRows = (list) => list.map((pair) => [pair.chemicalA.name, pair.chemicalB.name, `${pair.sourceCode || "?"}${pair.overrideMarker || ""}`, pair.status, join(pair.consequenceTags), join(pair.possibleGases), join([...(pair.evidence || []).map((item) => item.summary), ...(pair.missingGroupPairs || []), ...(pair.uncertaintyFlags || [])]), join((pair.sourceRefs || []).map(sourceText)), scenarioText(pair.scenario || scenario)]);
  addSheet(workbook, "不相容明细", detailColumns, detailRows(pairs.filter((pair) => ["INCOMPATIBLE", "CONFLICT_REVIEW"].includes(pair.status))));
  addSheet(workbook, "谨慎与未知", detailColumns, detailRows(pairs.filter((pair) => ["CAUTION", "UNKNOWN"].includes(pair.status))));
  addSheet(workbook, "可能气体与后果", detailColumns.slice(0, 6), pairs.filter((pair) => pair.consequenceTags?.length || pair.possibleGases?.length).map((pair) => [pair.chemicalA.name, pair.chemicalB.name, pair.sourceCode, pair.status, join(pair.consequenceTags), join(pair.possibleGases)]));
  addSheet(workbook, "隔离核实清单", [{ header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "状态", width: 22 }, { header: "核实动作", width: 80 }], pairs.map((pair) => [pair.chemicalA.name, pair.chemicalB.name, pair.status, join(pair.storageActions)]));
  addSheet(workbook, "证据与来源", [{ header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "证据类型", width: 20 }, { header: "摘要", width: 60 }, { header: "来源ID/记录/版本", width: 50 }], pairs.flatMap((pair) => (pair.evidence || []).map((item) => [pair.chemicalA.name, pair.chemicalB.name, item.evidenceType, item.summary, join(item.sourceRefs?.map(sourceText))])));
  addSheet(workbook, "人工修订记录", [{ header: "修订ID", width: 24 }, { header: "组合", width: 34 }, { header: "原预测", width: 20 }, { header: "修订后", width: 20 }, { header: "理由", width: 55 }, { header: "状态", width: 16 }, { header: "修订人/时间", width: 34 }, { header: "复核人/时间", width: 34 }, { header: "证据", width: 50 }], overrides.map((item) => [item.id, item.pairKey, item.predictedStatus, item.revisedStatus, item.reason, item.status, join([item.createdBy, item.createdAt]), join([item.reviewedBy, item.reviewedAt]), join(item.evidenceRefs?.map(sourceText))]));
  addSheet(workbook, "项目备注", [{ header: "项目字段", width: 24 }, { header: "内容", width: 90 }], [["项目名", project.name], ["场所/装置", project.site], ["创建人", project.createdBy], ["复核人", project.reviewedBy], ["项目状态", project.status], ["项目版本", project.version], ["项目备注", project.notes], ["固有反应性摘要", join(intrinsic.map((item) => `${item.chemicalA.name}:${item.sourceCode}`))], ["当前情景", scenarioText(scenario)]]);
  addSheet(workbook, "数据版本与变更", [{ header: "字段", width: 28 }, { header: "值", width: 90 }], [["规则版本", payload.ruleVersion], ["参考工具版本", payload.referenceToolVersion || "CRW 4.0.3"], ["数据版本", manifest.dataVersion], ["来源模式", manifest.sourceMode], ["生成时间", manifest.generatedAt], ["复核时间", manifest.reviewedAt], ["权利闸门", JSON.stringify(manifest.rightsGate || {})], ["项目历史", JSON.stringify(project.history || [])]]);
  return workbook;
}
export function exportFilename(projectName = "") { const clean = String(projectName || "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 40); return `EHS-SIL_化学品反应与禁忌矩阵${clean ? `_${clean}` : ""}_${new Date().toISOString().slice(0, 10)}.xlsx`; }

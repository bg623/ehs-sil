const HEADERS = {
  navy: "0D2836", teal: "176574", white: "FFFFFF", line: "D8D4CB",
  red: "FDE8E7", amber: "FFF4CE", gray: "EEF1F2", purple: "F1E8F6", green: "E8F5EC"
};

function safe(value) { return value == null ? "" : String(value); }
function join(values) { return (values || []).filter(Boolean).join("；"); }
function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { name: "Microsoft YaHei", bold: true, color: { argb: HEADERS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADERS.navy } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}
function styleRows(sheet) {
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.eachCell((cell) => {
      cell.font = { name: "Microsoft YaHei", size: 9 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: HEADERS.line } } };
    });
  });
}
function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  sheet.columns = columns;
  styleHeader(sheet.getRow(1));
  rows.forEach((values) => sheet.addRow(values));
  styleRows(sheet);
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}1` };
  sheet.headerFooter.oddHeader = "筛查工具，不等于安全批准";
  sheet.headerFooter.oddFooter = "EHS-SIL｜第 &P / &N 页";
  return sheet;
}

export function buildReactivityWorkbook(ExcelJS, payload = {}) {
  if (!ExcelJS?.Workbook) throw new Error("ExcelJS 不可用");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EHS-SIL";
  workbook.created = new Date();
  const records = payload.records || [];
  const pairs = payload.summary?.pairs || [];
  const manifest = payload.manifest || {};
  const now = new Date().toISOString();

  addSheet(workbook, "说明与限制", [{ header: "项目", width: 24 }, { header: "内容", width: 100 }], [
    ["文件定位", "化学品反应性筛查与证据整理，不代表相容、安全、允许混合或工程批准。"],
    ["算法限制", "矩阵只展开二元组合，不预测三元协同、催化效应、实际投料顺序或工艺尺度影响。"],
    ["数据模式", safe(manifest.sourceMode)], ["数据版本", safe(manifest.dataVersion)], ["生成时间", now],
    ["复核要求", "结合实际浓度、温度、压力、杂质、稳定剂、设备材质、最新版 SDS、GB 15603—2022 和企业制度复核。"]
  ]);
  addSheet(workbook, "化学品主表", [
    { header: "记录ID", width: 24 }, { header: "名称", width: 32 }, { header: "CAS", width: 16 }, { header: "UN/NA", width: 16 },
    { header: "形态/浓度", width: 28 }, { header: "反应组", width: 32 }, { header: "证据层级", width: 22 }, { header: "来源版本", width: 30 }
  ], records.map((record) => [record.id, record.preferredName, record.casNumber, join(record.unNumbers), join([record.substanceForm, record.concentrationNote]), join(record.reactiveGroupIds), record.evidenceLayer, join(record.sourceRefs?.map((source) => `${source.sourceId}/${source.version}`))]));

  const matrixSheet = workbook.addWorksheet("两两相容矩阵", { views: [{ state: "frozen", xSplit: 1, ySplit: 1, showGridLines: false }] });
  matrixSheet.addRow(["化学品", ...records.map((record) => record.preferredName)]);
  styleHeader(matrixSheet.getRow(1));
  records.forEach((record, i) => matrixSheet.addRow([record.preferredName, ...(payload.matrix?.[i] || []).map((cell) => cell.status)]));
  matrixSheet.getColumn(1).width = 28;
  for (let i = 2; i <= records.length + 1; i += 1) matrixSheet.getColumn(i).width = 18;
  styleRows(matrixSheet);
  matrixSheet.headerFooter.oddHeader = "筛查工具，不等于安全批准";

  const detailColumns = [
    { header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "状态", width: 22 },
    { header: "后果标签", width: 34 }, { header: "可能气体", width: 32 }, { header: "证据/缺口", width: 60 }, { header: "来源", width: 42 }
  ];
  const detailRows = (list) => list.map((pair) => [pair.chemicalA.name, pair.chemicalB.name, pair.status, join(pair.consequenceTags), join(pair.possibleGases), join([...pair.evidence.map((item) => item.summary), ...pair.missingGroupPairs, ...pair.uncertaintyFlags]), join(pair.sourceRefs.map((source) => `${source.sourceId}/${source.recordId || "-"}/${source.version}`))]);
  addSheet(workbook, "不相容明细", detailColumns, detailRows(pairs.filter((pair) => ["INCOMPATIBLE", "CONFLICT_REVIEW"].includes(pair.status))));
  addSheet(workbook, "谨慎与未知", detailColumns, detailRows(pairs.filter((pair) => ["CAUTION", "UNKNOWN"].includes(pair.status))));
  addSheet(workbook, "可能气体与后果", detailColumns.slice(0, 5), pairs.filter((pair) => pair.consequenceTags.length || pair.possibleGases.length).map((pair) => [pair.chemicalA.name, pair.chemicalB.name, pair.status, join(pair.consequenceTags), join(pair.possibleGases)]));
  addSheet(workbook, "隔离核实清单", [
    { header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "状态", width: 22 }, { header: "核实动作", width: 80 }
  ], pairs.map((pair) => [pair.chemicalA.name, pair.chemicalB.name, pair.status, join(pair.storageActions)]));
  addSheet(workbook, "证据与来源", [
    { header: "化学品A", width: 28 }, { header: "化学品B", width: 28 }, { header: "证据类型", width: 20 }, { header: "摘要", width: 60 }, { header: "来源ID/记录/版本", width: 50 }
  ], pairs.flatMap((pair) => pair.evidence.map((item) => [pair.chemicalA.name, pair.chemicalB.name, item.evidenceType, item.summary, join(item.sourceRefs?.map((source) => `${source.sourceId}/${source.recordId || "-"}/${source.version}`))])));
  addSheet(workbook, "数据版本与变更", [{ header: "字段", width: 28 }, { header: "值", width: 90 }], [
    ["数据版本", manifest.dataVersion], ["来源模式", manifest.sourceMode], ["生成时间", manifest.generatedAt], ["复核时间", manifest.reviewedAt], ["权利闸门", JSON.stringify(manifest.rightsGate || {})]
  ]);
  return workbook;
}

export function exportFilename() {
  return `EHS-SIL_化学品反应与禁忌矩阵_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

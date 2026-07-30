import assert from "node:assert/strict";
import fs from "node:fs";

const ruleset = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url), "utf8"),
);
const catalog = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-source-catalog.json", import.meta.url), "utf8"),
);

assert.equal(catalog.schema_version, "1.0");
assert.match(catalog.verified_on, /^\d{4}-\d{2}-\d{2}$/);
assert.match(catalog.notice, /不代表自动判定法规适用性或合规性/);
assert.ok(Object.keys(catalog.sources).length >= 16, "来源目录至少应覆盖16项权威来源");

const usedRefs = new Set();
for (const rule of ruleset.rules) {
  assert.ok(rule.source_refs.length > 0, `${rule.rule_id}没有来源引用`);
  for (const sourceId of rule.source_refs) {
    const source = catalog.sources[sourceId];
    assert.ok(source, `${rule.rule_id}引用不存在的来源${sourceId}`);
    assert.equal(source.status, "verified_current", `${sourceId}状态不是已核实现行`);
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.reference);
    assert.ok(source.title_zh);
    assert.ok(source.title_en);
    assert.ok(source.publisher_zh);
    assert.ok(source.publisher_en);
    assert.ok(source.scope_note);
    usedRefs.add(sourceId);
  }
}

const activeRuleSources = ruleset.rules.map((rule) => rule.source).join("；");
assert.doesNotMatch(
  activeRuleSources,
  /GB\/T 3608-2008/,
  "规则不得继续引用已废止的旧版高处作业标准",
);
assert.match(activeRuleSources, /GB 3608-2025/, "必须引用现行高处作业标准");
assert.match(catalog.sources["GB-30871-2022"].scope_note, /危险化学品生产/);
assert.match(catalog.sources["GB-30871-2022"].scope_note, /其他行业/);
assert.equal(usedRefs.size, Object.keys(catalog.sources).length, "来源目录存在未被规则使用的孤立记录");

const bilingualVisibleTerms = [
  ruleset.rules.find((rule) => rule.rule_id === "JSA-CHEM-001").recommended_action,
  ruleset.rules.find((rule) => rule.rule_id === "JSA-NONROUTINE-001").recommended_action,
  ruleset.rules.find((rule) => rule.rule_id === "JSA-CONTROL-001").rule_name,
];
for (const text of bilingualVisibleTerms) {
  assert.match(text, /[\u4e00-\u9fff]+（[A-Za-z]/, `英文术语缺少中英文显示：${text}`);
}

console.log(JSON.stringify({
  status: "PASS",
  rules: ruleset.rules.length,
  verifiedSources: Object.keys(catalog.sources).length,
  usedSources: usedRefs.size,
}));

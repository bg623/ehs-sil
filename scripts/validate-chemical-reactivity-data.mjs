import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { validateProductionData } from "../js/chemical-reactivity-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data/chemical-reactivity");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const manifest = read("source-manifest.json");
const chemicals = read("chemicals.index.json");
const groupPairs = read("reactive-group-pairs.json");
const directEvidence = read("direct-evidence.json");
const fixture = read("fixtures.synthetic.json");

validateProductionData({ manifest, chemicals, groupPairs, directEvidence });
if (!fixture.testOnly || fixture.licenseClass !== "TEST_ONLY") throw new Error("合成 fixture 必须明确标记 TEST_ONLY");
for (const filename of manifest.dataFiles || []) {
  if (!fs.existsSync(path.join(dataDir, filename))) throw new Error(`数据清单引用缺失文件：${filename}`);
  const actual = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(dataDir, filename))).digest("hex")}`;
  if (manifest.checksums?.[filename] !== actual) throw new Error(`数据文件校验和不匹配：${filename}`);
}
const productionText = manifest.dataFiles.map((name) => fs.readFileSync(path.join(dataDir, name), "utf8")).join("\n");
if (/SYNTH-|TEST_ONLY|合成测试/.test(productionText)) throw new Error("生产数据包包含合成测试记录");
console.log(JSON.stringify({ status: "PASS", sourceMode: manifest.sourceMode, productionRecords: chemicals.length + groupPairs.length + directEvidence.length, fixtureExcluded: true }));

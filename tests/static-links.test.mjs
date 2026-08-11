import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = [];

function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    if (name === ".git") continue;
    const entry = path.join(directory, name);
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) walk(entry);
    else if (entry.endsWith(".html")) htmlFiles.push(entry);
  }
}

walk(root);
const broken = [];
let references = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const original = match[1];
    if (!original || /^(?:https?:|data:|mailto:|tel:|javascript:|#)/.test(original)) continue;
    let reference = original.split("#")[0].split("?")[0];
    if (!reference) continue;
    try { reference = decodeURIComponent(reference); } catch { /* retain literal path */ }
    references += 1;
    let target = reference.startsWith("/")
      ? path.join(root, reference)
      : path.resolve(path.dirname(file), reference);
    if (reference.endsWith("/")) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) broken.push(`${path.relative(root, file)} -> ${original}`);
  }
}

assert.deepEqual(broken, [], `发现失效的静态站内引用：\n${broken.join("\n")}`);
console.log(JSON.stringify({ status: "PASS", html: htmlFiles.length, references, broken: 0 }));

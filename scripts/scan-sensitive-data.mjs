import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const sandboxRoots = ["sandbox/incident", "tests/incident-2a-sandbox-api.test.mjs", "docs/incident-lfi-2a-sandbox-completion.md"];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*=\s*[^\s]+/i,
];
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi;

function filesAt(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => filesAt(path.join(target, entry.name)));
}

const trackedFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", "*.js", "*.mjs", "*.json", "*.yml", "*.yaml", "*.md", "*.sql", "*.html", "*.css"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).map((file) => path.join(root, file));
const sandboxFiles = new Set(sandboxRoots.flatMap(filesAt));
const files = [...new Set(trackedFiles)];
const violations = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) violations.push(`${path.relative(root, file)}: secret-like value`);
  if (sandboxFiles.has(file)) for (const email of content.match(emailPattern) ?? []) {
    if (!email.toLowerCase().endsWith(".example.invalid")) violations.push(`${path.relative(root, file)}: non-synthetic Sandbox email ${email}`);
  }
}

assert.deepEqual(violations, [], `Sensitive-data scan failed:\n${violations.join("\n")}`);
console.log(JSON.stringify({ status: "PASS", tracked_text_files: files.length, sandbox_files: sandboxFiles.size, synthetic_email_suffix: ".example.invalid", production_secrets: 0 }));

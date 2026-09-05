#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
const output = process.argv[3] || path.join(root, 'assets/data/ehs-glossary.json');
if (!input) {
  console.error('Usage: node scripts/import-ehs-glossary.mjs INPUT.xlsx [OUTPUT.json]');
  process.exit(2);
}

const result = spawnSync(process.env.PYTHON || 'python3', [
  path.join(root, 'scripts/import-ehs-glossary.py'),
  input,
  output,
], { stdio: 'inherit' });

if (result.error) {
  console.error('无法启动Python导入脚本：', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/ehs-glossary.json'), 'utf8'));
const page = fs.readFileSync(path.join(root, 'tools/ehs-glossary.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'js/ehs-glossary.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/ehs-glossary.css'), 'utf8');

function normalize(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en').replace(/[\s\-‐‑‒–—―_/]+/g, '');
}

function matches(term, query) {
  const needle = normalize(query);
  return [term.english, term.abbreviation, term.chinese, term.definition, term.scenario]
    .some((value) => normalize(value).includes(needle));
}

test('glossary JSON satisfies the workbook release contract', () => {
  assert.equal(data.total, 445);
  assert.equal(data.terms.length, 445);
  assert.equal(data.categoryTotal, 18);
  assert.equal(data.categories.length, 18);
  assert.equal(data.abbreviationTotal, 196);
  assert.equal(data.terms.filter((term) => term.abbreviation).length, 196);
  assert.equal(data.confusionTotal, 24);
  assert.equal(data.confusions.length, 24);
  assert.equal(data.sourceUrlTotal, 161);
  assert.deepEqual(
    Object.fromEntries(['核心', '常用', '进阶'].map((level) => [level, data.terms.filter((term) => term.importance === level).length])),
    { 核心: 289, 常用: 62, 进阶: 94 },
  );
  assert.equal(new Set(data.terms.map((term) => term.english)).size, 445);
  assert.equal(new Set(data.terms.map((term) => term.chinese)).size, 445);
  assert.deepEqual(data.terms.map((term) => term.id), Array.from({ length: 445 }, (_, index) => index + 1));
  assert.equal(data.terms.filter((term) => term.abbreviation === 'EAP').length, 2);
  assert.equal(data.terms.filter((term) => term.abbreviation === 'EPR').length, 2);
  assert.equal(data.terms.filter((term) => [term.abbreviation, term.sourceUrl].includes(57) || [term.abbreviation, term.sourceUrl].includes('57')).length, 0);
  for (const term of data.terms.filter((row) => row.sourceUrl)) assert.match(term.sourceUrl, /^https?:\/\//);
});

test('required acceptance queries resolve against the complete data set', () => {
  for (const query of ['LOTO', '上锁挂牌', 'Line of Fire', '伤害路径', 'HAZOP', 'LOPA', 'SIL', '旁路']) {
    assert.ok(data.terms.some((term) => matches(term, query)), `查询无结果：${query}`);
  }
  assert.equal(data.terms.filter((term) => normalize(term.abbreviation) === 'eap').length, 2);
  assert.equal(data.terms.filter((term) => normalize(term.abbreviation) === 'epr').length, 2);
  assert.equal(data.terms.filter((term) => matches(term, '不存在的测试词')).length, 0);
  const bowTie = data.terms.filter((term) => matches(term, 'Bow-Tie')).map((term) => term.id);
  const bowtie = data.terms.filter((term) => matches(term, 'Bowtie')).map((term) => term.id);
  assert.deepEqual(bowTie, bowtie);
});

test('page exposes SEO, accessible tabs, download, and prerendered terminology', () => {
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.match(page, /rel="canonical" href="https:\/\/ehs-sil\.com\/tools\/ehs-glossary\.html"/);
  assert.match(page, /"CollectionPage"/);
  assert.match(page, /"WebApplication"/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /download="EHS术语中英文对照大全-445词\.xlsx"/);
  assert.ok((page.match(/<article class="term-card"/g) || []).length >= 10);
  assert.ok((page.match(/<h3>/g) || []).length >= 10);
  assert.match(page, /本术语库用于EHS学习、翻译和专业沟通/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/, '动态术语内容不得通过innerHTML拼接');
  assert.match(script, /searchParams\.get\('term'\)/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(styles, /@media \(max-width: 420px\)/);
});

test('download workbook remains an XLSX package with five worksheets', () => {
  const workbook = fs.readFileSync(path.join(root, 'assets/downloads/ehs-sil-ehs-glossary-445.xlsx'));
  assert.equal(workbook.subarray(0, 2).toString('ascii'), 'PK');
  const entries = new Set([...workbook.toString('latin1').matchAll(/xl\/worksheets\/sheet\d+\.xml/g)].map((match) => match[0]));
  assert.equal(entries.size, 5);
});

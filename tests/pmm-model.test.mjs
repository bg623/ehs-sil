import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReport,examples,hypotheses,excelText} from '../js/pmm-model.mjs';
test('PMM public copy focuses on use rather than document preparation',()=>{
  for(const path of ['../tools/pmm-coach.html','../js/pmm-app.mjs']){
    assert.doesNotMatch(fs.readFileSync(new URL(path,import.meta.url),'utf8'),/脱敏|原单位|原企业|原材料|用户提供|内部文号|原文件|改编/);
  }
  const html=fs.readFileSync(new URL('../tools/pmm-coach.html',import.meta.url),'utf8');
  assert.match(html,/对话模板与方法指南/);
  assert.match(html,/专业参考与使用范围/);
  assert.match(html,/ehs-sil-pmm-dialogue\.xlsx\?v=20260919-copy/);
  assert.match(html,/ehs-sil-pmm-guide\.docx\?v=20260919-copy/);
});
test('PMM missing inputs stay unresolved, never infer safety or blame',()=>{const r=buildReport({});assert.ok(r.missing.length>=6);assert.deepEqual(r.hypotheses,[]);assert.ok(!('score' in r));assert.match(r.boundary,/不构成行为定性/);});
test('PMM multiple explanations survive without forced category',()=>{const r=buildReport({...examples.improvement,hypotheses:hypotheses.map(h=>h.id)});assert.equal(r.hypotheses.length,5);assert.match(r.hypotheses.at(-1).action,/不得/);});
test('PMM recognition excludes stale unsafe-behavior hypotheses',()=>{const r=buildReport({...examples.recognition,hypotheses:['slip','routine']});assert.deepEqual(r.hypotheses,[]);assert.ok(r.impact);assert.ok(!r.missing.includes('待核实的解释（可选“信息不足”）'));});
test('PMM actions stay bounded and claimed verification needs review',()=>{const r=buildReport({actions:Array.from({length:30},()=>({action:'test',status:'已验证'}))});assert.equal(r.actions.length,12);assert.ok(r.missing.some(s=>s.includes('证据真伪')));});
test('PMM Excel formula inputs are literal text',()=>{for(const value of ['=1+1','+SUM(A1)','-1+1','@SUM(A1)',' \t=HYPERLINK("x")'])assert.ok(excelText(value).startsWith("'"));assert.equal(excelText('正常文本'),'正常文本');});
test('PMM local-only shell and no telemetry or persistent storage',()=>{const html=fs.readFileSync(new URL('../tools/pmm-coach.html',import.meta.url),'utf8');const js=fs.readFileSync(new URL('../js/pmm-app.mjs',import.meta.url),'utf8');assert.match(html,/data-site-shell-features="local"/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(js,/localStorage|sessionStorage|fetch\(|sendBeacon|innerHTML/);assert.match(js,/invalidate/);});

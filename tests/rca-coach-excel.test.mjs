import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCase,example,addCause,addAction} from '../js/rca-coach-model.mjs';
import {excelBytes} from '../js/rca-coach-export.mjs';
const require=createRequire(import.meta.url),ExcelJS=require('../vendor/exceljs.min.js');
test('RCA Excel keeps literal user text, typed dates, empty cells and complete cause chains',async()=>{
 const s=example();s.problem.title='=1+1 <img src=x onerror=alert(1)>';s.problem.date='2026-09-24';
 let parent='C4';for(let i=0;i<7;i++)parent=addCause(s,{text:'条件 '+i,parent}).id;
 addAction(s,{causes:[parent],text:'+SUM(A1:A2)',due:'2026-10-01',criterion:'第一行\n第二行\n第三行'});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await excelBytes(s,ExcelJS));
 assert.deepEqual(wb.worksheets.map(w=>w.name),['分析概览','原因与证据','行动与验证','复核清单']);
 assert.equal(wb.getWorksheet('分析概览').getCell('B2').value,s.problem.title);
 assert.equal(wb.getWorksheet('分析概览').getCell('B4').value.toISOString().slice(0,10),'2026-09-24');
 assert.equal(wb.getWorksheet('行动与验证').getCell('C2').value,'+SUM(A1:A2)');
 assert.equal(wb.getWorksheet('行动与验证').getCell('F2').value.toISOString().slice(0,10),'2026-10-01');
 assert.equal(wb.getWorksheet('行动与验证').getCell('E2').value,null);
 assert.match(wb.getWorksheet('原因与证据').getCell('E12').value,/C1 → C2 → C4 → C5/);
 for(const ws of wb.worksheets){assert.equal(ws.views[0].showGridLines,false);ws.eachRow(row=>{assert.ok(Number.isFinite(row.height)&&row.height>=36);row.eachCell(cell=>assert.notEqual(cell.type,6,'No executable formula'));});}
});
test('RCA empty Excel exports four useful sheets without invalid row heights',async()=>{
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await excelBytes(createCase(),ExcelJS));
 assert.equal(wb.worksheets.length,4);assert.equal(wb.getWorksheet('原因与证据').rowCount,1);
 assert.equal(wb.getWorksheet('分析概览').getCell('B4').value,null);
});

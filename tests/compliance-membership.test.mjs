import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=new URL("../",import.meta.url),read=p=>fs.readFileSync(new URL(p,root),"utf8");
const html=read("tools/compliance-identification.html"),app=read("js/compliance-app.js"),analytics=read("js/compliance-analytics.js");
assert.match(html,/在线识别免费/);assert.match(html,/下载固定示例 Excel/);assert.match(html,/下载专业 Excel/);assert.match(html,/会员登录 \/ 激活权益/);assert.match(html,/加入外企 EHS 工具箱/);assert.match(html,/129元\/年工具箱会员/);assert.match(html,/不再销售独立29\.9元网站VIP/);assert.match(html,/returnTo=%2Ftools%2Fcompliance-identification\.html/);
assert.match(app,/EXPORT_CAPABILITY="compliance_excel_export"/);assert.match(app,/hasCapability\(EXPORT_CAPABILITY,true\)/);assert.match(app,/withExportCapability\(exportExcel\)/);assert.match(app,/withExportCapability\(exportProject\)/);assert.match(app,/withExportCapability\(\(\)=>\$\('#projectFile'\)\.click\(\)\)/);
assert.match(html,/前 6 条结果/);assert.match(html,/VIP 导出完整 Excel/);assert.match(app,/FREE_PREVIEW_LIMIT=6/);assert.match(app,/preview\(filtered\(\)\)/);
for(const event of ["result_generated","export_clicked","excel_exported","vip_prompt_viewed","vip_entry_clicked","knowledge_planet_clicked"]){assert.match(analytics,new RegExp(`"${event}"`),`合规转化事件缺少 ${event}`);assert.match(app,new RegExp(`track\\('${event}'`),`页面未触发 ${event}`);}
for(const forbidden of ["companyName","evidence","activation","code","owner"])assert.doesNotMatch(analytics,new RegExp(`detail\\s*:\\s*\\{[^}]*${forbidden}`,"i"));

const samplePath=new URL("../downloads/EHS-SIL_合规识别固定示例_山东淄博.xlsx",import.meta.url);assert.ok(fs.statSync(samplePath).size>15000);const unzip=entry=>execFileSync("unzip",["-p",fileURLToPath(samplePath),entry],{encoding:"utf8"});const workbookXml=unzip("xl/workbook.xml"),profileSheet=unzip("xl/worksheets/sheet1.xml"),evaluationSheet=unzip("xl/worksheets/sheet3.xml");for(const name of ["企业画像与使用说明","法规识别台账","符合性评价记录","法规动态跟踪及官方来源"])assert.match(workbookXml,new RegExp(`name="${name}"`));assert.match(profileSheet,/不得整表转售/);assert.match(evaluationSheet,/r="K5"[\s\S]*?<x:f>IF\(/i);

const authCode=read("js/auth.js"),responses=[{ok:true,active:true,capabilities:["compliance_excel_export"]},{ok:true,active:false,capabilities:[]}];let call=0;const sandbox={window:{},location:{reload(){},pathname:"/tools/compliance-identification.html",search:""},URLSearchParams,console,setTimeout,fetch:async()=>({ok:true,json:async()=>responses[call++],status:200})};sandbox.window.window=sandbox.window;vm.runInNewContext(authCode,sandbox);assert.equal(await sandbox.window.EhsSilVip.hasCapability("compliance_excel_export",true),true);assert.equal(await sandbox.window.EhsSilVip.hasCapability("compliance_excel_export",true),false);
console.log(JSON.stringify({status:"PASS",sampleBytes:fs.statSync(samplePath).size,sheets:4,capabilityChecks:2}));

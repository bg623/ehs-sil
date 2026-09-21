import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.INCIDENT_BASE_URL||'http://127.0.0.1:8774';
const out=process.env.INCIDENT_QA_DIR||'test-results/incident-coach';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const result=[];
try{for(const width of [1440,390,320]){
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('dialog',d=>d.accept());
 await page.goto(base+'/tools/incident-learning.html',{waitUntil:'networkidle'});await page.locator('#event-title').waitFor();
 assert.equal(await page.locator('#step-nav button').count(),8);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`${out}/hero-${width}.png`});
 if(width<800){await page.locator('.nav-toggle').click();assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'),'true');await page.getByRole('button',{name:'展开专业工具选项'}).click();assert.ok(await page.locator('.nav-dropdown a[href="../tools/incident-learning.html"]').isVisible());await page.locator('.nav-toggle').click();}
 await page.locator('#load-example').click();assert.match(await page.locator('#event-title').inputValue(),/虚构/);
 const payload='=1+1 <img src=x onerror=alert(1)>';await page.locator('#event-title').fill(payload);
 for(let i=1;i<8;i++){await page.locator('#step-nav button').nth(i).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`step ${i} ${width}`);if(i===1)assert.match(await page.locator('.ic-coaching').innerText(),/深度调查/);if(i===4)await page.screenshot({path:`${out}/barriers-${width}.png`});}
 await page.getByRole('button',{name:'预览 LFI 学习卡片',exact:true}).click();assert.equal(await page.locator('#report-content img').count(),0);assert.match(await page.locator('#report-content').innerText(),/分析假设/);assert.match(await page.locator('#report-content').innerText(),/单一来源/);
 await page.locator('#report-region').screenshot({path:`${out}/lfi-${width}.png`});
 let pending=page.waitForEvent('download');await page.locator('#export-excel').click();let download=await pending;const xlsx=`${out}/export-${width}.xlsx`;await download.saveAs(xlsx);assert.equal(await download.failure(),null);
 const xml=execFileSync('unzip',['-p',xlsx,'xl/worksheets/*.xml'],{maxBuffer:2000000}).toString();assert.doesNotMatch(xml,/<f[ >]/,'User input must remain a string, never an Excel formula');assert.doesNotMatch(xml,/ht="NaN"/,'Blank cells must not invalidate row heights');
 const strings=execFileSync('unzip',['-p',xlsx,'xl/sharedStrings.xml'],{maxBuffer:2000000}).toString();assert.match(strings,/=1\+1/);assert.match(strings,/分析假设/);assert.match(strings,/效果依据/);assert.doesNotMatch(strings,/<t><\/t>/,'Blank cells must remain empty across spreadsheet viewers');
 pending=page.waitForEvent('download');await page.locator('#backup-case').click();download=await pending;const json=`${out}/backup-${width}.json`;await download.saveAs(json);const backup=JSON.parse(await fs.readFile(json,'utf8'));assert.equal(backup.event.title,payload);
 await page.locator('#clear-case').click();assert.equal(await page.locator('#event-title').inputValue(),'');await page.locator('#backup-file').setInputFiles(json);await page.waitForFunction(expected=>document.querySelector('#event-title')?.value===expected,payload);assert.equal(await page.locator('#event-title').inputValue(),payload);
 await page.locator('#backup-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":"bad"}')});await page.waitForFunction(()=>document.querySelector('#coach-status')?.textContent.includes('无法恢复'));assert.match(await page.locator('#coach-status').innerText(),/无法恢复/);assert.equal(await page.locator('#event-title').inputValue(),payload);
 await page.locator('#step-nav button').nth(2).click();await page.getByRole('button',{name:'移除此条',exact:true}).click();await page.getByRole('button',{name:'＋ 添加证据矩阵记录',exact:true}).click();assert.equal(await page.locator('#E2-text').count(),1);
 await page.locator('#step-nav button').nth(7).click();assert.match(await page.locator('#step-content').innerText(),/已不存在的 E1/);await page.locator('#next-step').click();
 if(width===1440){await page.emulateMedia({media:'print'});await page.pdf({path:`${out}/report.pdf`,format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});}
 await page.locator('#step-nav button').nth(0).click();await page.locator('#event-title').fill('changed');assert.equal(await page.locator('#report-region').isVisible(),false);
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(requests.filter(r=>new URL(r.url).origin!==new URL(base).origin||r.method!=='GET').length,0);assert.deepEqual(errors,[]);
 await page.locator('#clear-case').click();await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#event-title').inputValue(),'');await context.close();result.push({width,status:'passed',checks:['eight steps','navigation','high potential','XSS','Excel literal cells','backup roundtrip','bad backup','missing references','preview invalidation','no transmission/storage','clear']});
}
const c=await browser.newContext();const p=await c.newPage();await p.goto(base+'/index.html',{waitUntil:'networkidle'});await p.locator('#task-tab-learning').click();assert.equal(await p.locator('#task-panel-learning a[href="tools/incident-learning.html"]').count(),1);assert.equal(await p.locator('#incident-tools a[href="tools/incident-learning.html"]').count(),1);result.push({homeEntry:'passed'});await c.close();await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}

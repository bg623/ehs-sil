import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.PMM_BASE_URL||'http://127.0.0.1:8773';
const out=process.env.PMM_QA_DIR||'test-results/pmm';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const results=[];
try{
for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('dialog',d=>d.accept());
  await page.goto(base+'/tools/pmm-coach.html',{waitUntil:'networkidle'});await page.locator('.pmm-action').waitFor();
  assert.equal(await page.locator('.site-shell-header').count(),1);assert.equal(await page.locator('.site-shell-footer').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
  await page.screenshot({path:`${out}/desktop-mobile-${width}.png`,fullPage:true});
  await page.screenshot({path:`${out}/first-screen-${width}.png`});
  await page.locator('#load-example').click();await page.locator('[type=submit]').click();assert.equal(await page.locator('#result').isVisible(),true);
  assert.match(await page.locator('#report').innerText(),/虚构教学示例/);
  assert.match(await page.locator('#report').innerText(),/待核实解释/);
  await page.locator('[name=event]').fill('=1+1 <img src=x onerror=alert(1)>');assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('[type=submit]').click();assert.equal(await page.locator('#report img').count(),0);
  const download=page.waitForEvent('download');await page.locator('#export-excel').click();const d=await download;await d.saveAs(`${out}/export-${width}.xlsx`);assert.equal(await d.failure(),null);
  await page.locator('[name=mode][value=recognition]').check();await page.locator('#load-example').click();await page.locator('[type=submit]').click();assert.match(await page.locator('#report').innerText(),/正向认可/);assert.doesNotMatch(await page.locator('#report').innerText(),/待核实解释：/);
  await page.screenshot({path:`${out}/recognition-${width}.png`,fullPage:true});
  await page.locator('#result').screenshot({path:`${out}/report-${width}.png`});
  if(width===1440){await page.emulateMedia({media:'print'});await page.pdf({path:`${out}/report.pdf`,format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});}
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  assert.equal(requests.filter(r=>new URL(r.url).origin!==new URL(base).origin||r.method!=='GET').length,0);
  assert.deepEqual(errors,[]);
  await page.locator('#clear-record').click();assert.equal(await page.locator('[name=event]').inputValue(),'');assert.equal(await page.locator('#result').isVisible(),false);
  results.push({width,status:'passed',checks:['layout','shared navigation','improvement','recognition','preview invalidation','XSS text','Excel export','no telemetry or storage','clear']});await context.close();
}
const context=await browser.newContext();const page=await context.newPage();await page.goto(base+'/index.html',{waitUntil:'networkidle'});assert.ok(await page.locator('#practice-tools a[href="tools/pmm-coach.html"]').count());await page.goto(base+'/tools/index.html',{waitUntil:'networkidle'});await page.locator('#searchInput').fill('PMM');await page.waitForTimeout(450);assert.equal(await page.locator('#online-pmm').isVisible(),true);assert.equal(await page.locator('#online-moc').isVisible(),false);results.push({entryAndSearch:'passed'});await context.close();
console.log(JSON.stringify(results,null,2));await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));
}finally{await browser.close();}

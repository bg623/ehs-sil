import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.REVIEW_BASE_URL||'http://127.0.0.1:8786';
const out=process.env.REVIEW_QA_DIR||'test-results/system-review';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const report=[];
const inactive={ok:true,active:false,status:'inactive',capabilities:[]};
const active={ok:true,active:true,status:'active',entitlement_source:'toolbox_member',expires_at:'2036-12-31T23:59:59Z',capabilities:['compliance_excel_export']};
async function setup(width=1440,blockedStorage=false){
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});
 const controls={member:inactive,feedback:{ok:true,feedback_number:'FB-20261006-TEST0001'},feedbackStatus:200,sent:[]};
 // Every external request is intercepted. No production submissions, analytics or credentials.
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base)return route.continue();
  if(url.hostname==='vip-api.ehs-sil.com'){
   if(url.pathname==='/api/feedback'){controls.sent.push(JSON.parse(request.postData()||'{}'));return route.fulfill({status:controls.feedbackStatus,json:controls.feedback});}
   if(controls.member==='offline')return route.abort('failed');
   if(url.pathname==='/api/vip/logout')controls.member=inactive;
   return route.fulfill({json:controls.member});
  }
  return route.fulfill({status:200,body:'',contentType:'text/plain'});
 });
 if(blockedStorage)await context.addInitScript(()=>{
  for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Synthetic blocked storage','SecurityError');}});
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('dialog',dialog=>dialog.accept());
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 return {context,page,controls,errors};
}
async function run(name,fn){
 if(process.env.REVIEW_ONLY&&!name.includes(process.env.REVIEW_ONLY))return;
 try{await fn();report.push({name,status:'PASS'});console.log('PASS '+name);}
 catch(error){report.push({name,status:'FAIL',error:error.message});console.error('FAIL '+name+': '+error.message);}
}
async function download(page,selector,name){
 const pending=page.waitForEvent('download');await page.locator(selector).click();const file=await pending;
 assert.equal(await file.failure(),null);const target=path.join(out,name||file.suggestedFilename());await file.saveAs(target);
 assert.ok((await fs.stat(target)).size>50);return target;
}
try{
 const routes=['/index.html','/tools/index.html','/tools/jsa-tool.html','/tools/compliance-identification.html','/tools/training-matrix.html','/tools/incident-learning.html','/tools/moc-coach.html','/dashboard/register.html','/feedback.html'];
 for(const width of [1440,768,390,360])await run('responsive '+width,async()=>{
  const {context,page,errors}=await setup(width);
  try{for(const route of routes){
   await page.goto(base+route,{waitUntil:'networkidle'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' horizontal overflow');
   if(route.includes('/tools/')&&!route.endsWith('/index.html')){
    assert.equal(await page.locator('.tool-guide-status').count(),1);
    await page.locator('.tool-guide summary').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' expanded overflow');
   }
   if(width===1440||width===390)await page.screenshot({path:path.join(out,route.replaceAll('/','_').replace('.html','')+'-'+width+'.png')});
  }assert.deepEqual(errors,[]);}finally{await context.close();}
 });
 await run('home four task routes and matching disclosures',async()=>{
  const {context,page}=await setup();try{await page.goto(base);
   for(const [tab,tool] of [['risk','jsa-tool'],['compliance','compliance-identification'],['learning','incident-learning'],['growth','training-matrix']]){
    await page.locator('#task-tab-'+tab).click();const link=page.locator('#task-panel-'+tab+' a[href="tools/'+tool+'.html"]');
    assert.ok(await link.isVisible());assert.match(await link.innerText(),/免费|会员/);
    await link.focus();assert.equal(await link.evaluate(el=>el===document.activeElement),true);
   }
  }finally{await context.close();}
 });
 await run('OSS directory fallback redirects to explicit index routes',async()=>{
  const {context,page}=await setup();try{
   const fallback=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
   await page.route('**/*',route=>['/tools/','/tools','/articles/'].includes(new URL(route.request().url()).pathname)?route.fulfill({contentType:'text/html',body:fallback}):route.fallback());
   for(const alias of ['/tools/','/tools','/articles/']){
    await page.goto(base+alias);
    const target=alias.startsWith('/tools')?'/tools/index.html':'/articles/index.html';
    await page.waitForURL(base+target);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://ehs-sil.com'+target);
   }
  }finally{await context.close();}
 });
 await run('JSA example edit check preview and XLSX',async()=>{
  const {context,page,errors}=await setup();try{
   await page.goto(base+'/tools/jsa-tool.html',{waitUntil:'networkidle'});await page.locator('#loadExampleButton').click();
   await page.locator('#jobName').fill('虚构验证：离心泵检修');
   await page.locator('#stepList').getByRole('button',{name:'编辑',exact:true}).first().click();
   await page.locator('#stepDesc').fill('虚构验证：隔离并核实零能量');
   await page.locator('#saveStepButton').click();
   assert.match(await page.locator('#stepList').innerText(),/虚构验证：隔离并核实零能量/);
   await page.getByRole('button',{name:'检查完整性'}).click();
   await page.getByRole('button',{name:'网页预览'}).click();
   assert.match(await page.locator('#reportContent').innerText(),/风险分值（L×S）/);
   await download(page,'#exportExcelButton','jsa-example.xlsx');
   await page.screenshot({path:path.join(out,'jsa-result.png')});
   for(const width of [768,390,360]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'JSA generated result overflow '+width);
    if(width===390){
     await page.locator('#reportSection').evaluate(el=>el.scrollIntoView({block:'start'}));
     await page.screenshot({path:path.join(out,'jsa-result-390.png')});
    }
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await run('compliance free preview, service error, member XLSX and project roundtrip',async()=>{
  const {context,page,controls,errors}=await setup();try{
   await page.goto(base+'/tools/compliance-identification.html',{waitUntil:'networkidle'});await page.locator('#exampleBtn').click();
   await page.locator('#resultArea').waitFor({state:'visible'});
   assert.match(await page.locator('#previewNotice').innerText(),/前 6 条/);
   await page.locator('#summaryExportBtn').click();await page.locator('#memberExportModal').waitFor({state:'visible'});await page.locator('#memberModalClose').click();
   controls.member='offline';await page.locator('#summaryExportBtn').click();
   await page.locator('#membershipHint').filter({hasText:'暂未确认'}).waitFor();
   assert.ok(await page.locator('#memberExportModal').isHidden());assert.match(await page.locator('#membershipHint').innerText(),/暂未确认/);
   assert.ok((await page.locator('#companyName').inputValue()).length>0);
   controls.member=active;await download(page,'#summaryExportBtn','compliance-example.xlsx');
   const project=await download(page,'#exportProjectBtn','compliance-example.ehsproject.json');
   const saved=JSON.parse(await fs.readFile(project,'utf8'));assert.ok(saved.profile);
   await page.locator('#importProjectBtn').click();
   await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.locator('#projectFile').setInputFiles(project)]);
   await page.locator('#resultArea').waitFor({state:'visible'});
   assert.equal(await page.locator('#companyName').inputValue(),saved.profile.companyName);
   await page.screenshot({path:path.join(out,'compliance-result.png'),timeout:30000,animations:'disabled'});
   for(const width of [768,390,360]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'compliance generated result overflow '+width);
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 for(const blocked of [false,true])await run('training free generation and export; blockedStorage='+blocked,async()=>{
  const {context,page,errors}=await setup(1440,blocked);try{
   await page.goto(base+'/tools/training-matrix.html',{waitUntil:'networkidle'});
   await page.locator('[name="industry"][value="manufacturing"]').check();
   await page.locator('[name="roles"][value="maintenance"]').check();
   await page.locator('#nextBtn').click();await page.locator('#nextBtn').click();await page.locator('#nextBtn').click();
   await page.locator('#results').waitFor({state:'visible'});await download(page,'#excelBtn',blocked?'training-no-storage.xlsx':'training-example.xlsx');
   for(const width of [768,390,360]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'training generated result overflow '+width);
   }
   assert.match(await page.locator('.tool-guide-status').innerText(),/无需会员/);
   if(blocked)assert.match(await page.locator('.tm-privacy').innerText(),/存储不可用/);
   else{
    await page.evaluate(()=>localStorage.setItem('other-tool-sentinel','keep'));
    await page.locator('#clearBtn').click();await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(()=>localStorage.getItem('other-tool-sentinel')),'keep');
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await run('membership synthetic states and logout, never cache-granted',async()=>{
  const {context,page,controls}=await setup();try{
   for(const [status,expected] of [['inactive','登录 / 激活'],['active','已激活'],['expired','已到期'],['revoked','已失效'],['offline','暂未确认']]){
    controls.member=status==='offline'?'offline':status==='active'?active:{...inactive,status};
    await page.goto(base+'/dashboard/register.html',{waitUntil:'networkidle'});
    assert.match(await page.locator('[data-membership-status]').first().innerText(),new RegExp(expected));
    await page.screenshot({path:path.join(out,'member-'+status+'.png')});
   }
   controls.member=active;await page.goto(base+'/dashboard/register.html',{waitUntil:'networkidle'});
   await page.locator('[data-membership-logout]').click();assert.equal(await page.evaluate(()=>window.EhsSilVip.getState().active),false);
  }finally{await context.close();}
 });
 await run('feedback invalid receipt and server failure preserve draft; synthetic valid receipt',async()=>{
  const {context,page,controls}=await setup();try{
   await page.goto(base+'/feedback.html?tool=jsa-coach&from=%2Ftools%2Fjsa-tool.html',{waitUntil:'networkidle'});
   await page.locator('[name="feedback_type"]').selectOption('bug');
   const description='虚构测试：导出前显示未确认提示，请检查操作流程。';
   await page.locator('textarea[name="description"]').fill(description);
   for(const [status,body] of [[200,{}],[500,{message:'测试服务暂不可用'}]]){
    controls.feedbackStatus=status;controls.feedback=body;await page.locator('[type="submit"]').click();
    await page.locator('[data-feedback-message]').filter({hasText:'当前填写内容仍保留'}).waitFor();
    assert.equal(await page.locator('textarea[name="description"]').inputValue(),description);
    assert.ok(await page.locator('[data-feedback-receipt]').isHidden());
   }
   controls.feedbackStatus=200;controls.feedback={ok:true,feedback_number:'FB-20261006-TEST0001'};
   await page.locator('[type="submit"]').click();await page.locator('[data-feedback-receipt]').waitFor({state:'visible'});
   assert.equal(new Set(controls.sent.map(x=>x.request_id)).size,1);
   assert.equal(controls.sent[0].source_path,'/tools/jsa-tool.html');
   const events=await page.evaluate(()=>window._hmt||[]);assert.ok(!JSON.stringify(events).includes(description));
   await page.screenshot({path:path.join(out,'feedback-synthetic-receipt.png')});
  }finally{await context.close();}
 });
}finally{
 await browser.close();await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({environment:'LOCAL; all external requests intercepted; API responses synthetic',tests:report},null,2));
}
if(report.some(item=>item.status==='FAIL'))process.exitCode=1;

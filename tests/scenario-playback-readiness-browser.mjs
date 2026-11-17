// Synthetic module latency probes of the real app. This is not a GPU benchmark.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(root+'/build/scenario/package.json'),{chromium}=require('playwright');
const base=(process.env.SCENARIO_BASE_URL||'http://127.0.0.1:8786').replace(/\/$/,'');
const out=path.resolve(process.env.SCENARIO_PLAYBACK_QA_DIR||'test-results/scenario-v020-playback');
const sourceApp=process.env.SCENARIO_SOURCE_APP==='1';
await fs.mkdir(out,{recursive:true});
const rendererName=(await fs.readdir(root+'/dist/scenario/v0.2.0')).find(n=>/^view-3d-.*\.mjs$/.test(n));
const rendererBytes=await fs.readFile(root+'/dist/scenario/v0.2.0/'+rendererName,'utf8');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']});
const checks=[],errors=[];
const sample=page=>page.evaluate(()=>({progress:Number(document.getElementById('timeline').value),clocks:document.getElementById('workspace').dataset.activeClocks,status:document.getElementById('view-status').textContent,threeHidden:document.getElementById('view-3d-host').hidden,renderer:document.getElementById('view-3d-host').dataset.renderer||null}));
async function check(name,{delay=2000,abort=false}={},run){
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}),page=await context.newPage();
 let released=false;page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push({test:name,error:e.message}));
 try{
  await page.route('**/dist/scenario/v0.2.0/**',async route=>{
   const rel=new URL(route.request().url()).pathname.split('/dist/scenario/v0.2.0/')[1];
   if(/^view-3d(?:-.*)?\.mjs$/.test(rel)){
    await new Promise(resolve=>setTimeout(resolve,delay));released=true;
    if(abort)return route.abort();
    // A QA-only evaluation marker proves cancellation assertions run after the
    // real renderer module resolves; no frame, field or clock data is replaced.
    return route.fulfill({contentType:'text/javascript; charset=utf-8',body:rendererBytes+'\n;globalThis.__qaRendererModuleEvaluated = true;\n'});
   }
   if(sourceApp&&rel!=='worker.mjs'&&rel.endsWith('.mjs')&&!rel.split('/').includes('..')){
    try{
     let body=await fs.readFile(path.join(root,'js/scenario',rel),'utf8');
     // Source-only diagnosis must supply the same entry constant as the builder.
     if(rel==='app.mjs')body=body.replaceAll('SCENARIO_WORKER_URL','new URL("./worker.mjs", import.meta.url)');
     return await route.fulfill({contentType:'text/javascript; charset=utf-8',body});
    }catch(e){if(e.code!=='ENOENT')throw e;}
   }
   await route.continue();
  });
  await page.goto(base+'/tools/scenario-workbench.html',{waitUntil:'networkidle'});await page.locator('#workspace').waitFor();
  assert.equal((await sample(page)).clocks,'0');
  await page.locator('#play-example').click();
  await run(page,async()=>{
   const deadline=Date.now()+delay+60000;
   while(!released){assert.ok(Date.now()<deadline,'renderer request must release within the bounded preparation budget');await new Promise(resolve=>setTimeout(resolve,20));}
   if(!abort)await page.waitForFunction(()=>globalThis.__qaRendererModuleEvaluated===true,{},{timeout:60000});
   else await page.waitForLoadState('networkidle');
  });
  checks.push({name,status:'passed',final:await sample(page)});console.log('PASS',name);
 }catch(e){checks.push({name,status:'failed',error:e.message,final:await sample(page).catch(()=>null)});console.error('FAIL',name,e.message);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{});}
 finally{await context.close();}
}
await check('24-second renderer preparation does not consume the teaching timeline',{delay:24000},async(page,released)=>{
 await page.waitForTimeout(5000);assert.equal((await sample(page)).clocks,'0');assert.equal((await sample(page)).progress,0);
 await released();await page.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1',{},{timeout:60000});
 const ready=await sample(page);assert.equal(ready.renderer,'volumetric-raymarch');assert.ok(ready.progress<.1);
 await page.locator('#play').click();assert.equal((await sample(page)).clocks,'0');
});
await check('explicit 2D switch cancels the pending automatic start',{},async(page,released)=>{
 await page.locator('#view-2d').click();await released();await page.waitForTimeout(400);
 const state=await sample(page);assert.equal(state.clocks,'0');assert.equal(state.progress,0);assert.equal(state.threeHidden,true);assert.match(state.status,/当前使用 2D/);
});
await check('draft/scene replacement cancels the pending automatic start',{},async(page,released)=>{
 await page.locator('#modify-scene').click();await released();await page.waitForTimeout(400);
 assert.equal((await sample(page)).clocks,'0');assert.equal((await sample(page)).progress,0);
  assert.doesNotMatch((await sample(page)).status,/正在准备/);
});
await check('manual play then pause cannot be undone by renderer readiness',{},async(page,released)=>{
 await page.locator('#play').click();await page.locator('#play').click();assert.equal((await sample(page)).clocks,'0');
 await released();await page.waitForFunction(()=>document.getElementById('view-3d-host').dataset.renderer==='volumetric-raymarch',{},{timeout:60000});assert.equal((await sample(page)).clocks,'0');
});
await check('current renderer failure still permits explicit 2D fallback playback',{delay:1000,abort:true},async(page,released)=>{
 await released();await page.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1');
 const state=await sample(page);assert.equal(state.threeHidden,true);assert.match(state.status,/3D 不可用/);await page.locator('#play').click();
});
await check('stale import failure does not overwrite a newer explicit 2D choice',{delay:1000,abort:true},async(page,released)=>{
 await page.locator('#view-2d').click();await released();await page.waitForTimeout(400);
 const state=await sample(page);assert.equal(state.clocks,'0');assert.equal(state.threeHidden,true);assert.match(state.status,/当前使用 2D/);assert.doesNotMatch(state.status,/3D 不可用/);
});
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({browser:'isolated Chromium',sourceApp,scope:'Synthetic renderer-module delays/failures; real app state and real renderer where load succeeds. One QA evaluation flag is appended to the renderer module; no frame/field/clock data is replaced. Not a performance or visual-quality result.',checks,errors},null,2));
if(checks.some(c=>c.status!=='passed')||errors.length)process.exitCode=1;

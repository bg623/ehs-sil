// Real built-page integration probes; isolated fixture contexts, never a user profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {APP_VERSION} from '../js/scenario/version.mjs';
import {imageContent} from './scenario-m01-image-content.mjs';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url)),{chromium}=require('playwright');
const base=(process.env.SCENARIO_BASE_URL||'http://127.0.0.1:8787').replace(/\/$/,''),out=path.resolve(process.env.SCENARIO_M01_QA_DIR||'test-results/scenario-m01');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']});
const checks=[],errors=[],expectedShaderDiagnostics=[],requests=[],resources=[],visualEvidence=[];
const raw=await fs.readFile(new URL('./fixtures/scenario-v011-project.json',import.meta.url),'utf8');
const primary='methanol-atmospheric-tank-pool-fire';
const host=p=>p.locator('#view-3d-host'),clock=p=>p.locator('#workspace').getAttribute('data-active-clocks');
async function check(name,run,{legacy=false,record=false,shaderFailure=false,viewport={width:1440,height:1000}}={}) {
  let context,page,video;
  try {
    context=await browser.newContext({viewport,reducedMotion:'reduce',acceptDownloads:true,...(record?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1440,height:1000}}}:{})});
    page=await context.newPage();page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push({test:name,message:e.message}));
    page.on('console',message=>{
      if(message.type()==='error'||(message.type()==='warning'&&/shader|GLSL|INVALID_OPERATION|program not valid/i.test(message.text()))) {
        const diagnostic={test:name,type:message.type(),message:message.text(),location:message.location()};
        if(shaderFailure&&/INVALID_SHADER_TOKEN|shader.*compil|Fragment shader is not compiled/i.test(message.text()))expectedShaderDiagnostics.push(diagnostic);
        else errors.push(diagnostic);
      }
    });
    page.on('request',r=>requests.push({test:name,url:r.url(),method:r.method()}));
    page.on('dialog',d=>d.accept());
    await page.addInitScript(({legacy,raw})=>{
      localStorage.setItem('unrelated-tool-sentinel','keep');
      if(legacy)localStorage.setItem('ehs-sil-scenario-project-v2',raw);
      window.__qaWorkerPosts=0;const Native=window.Worker;window.Worker=class extends Native{postMessage(...args){window.__qaWorkerPosts++;return super.postMessage(...args);}};
    },{legacy,raw});
    if(shaderFailure)await page.route('**/view-3d-*.mjs',async route=>{
      const response=await route.fetch(),original=await response.text(),marker='Field field(vec3 p){';
      if(!original.includes(marker)){errors.push({test:name,message:'QA shader marker missing; no intentional failure was injected'});return route.abort();}
      page.__qaShaderInjected=true;
      await route.fulfill({response,body:original.replace(marker,marker+' INVALID_SHADER_TOKEN;')});
    });
    await page.goto(base+'/tools/scenario-workbench.html',{waitUntil:'networkidle',timeout:60000});
    await page.locator('#workspace').waitFor();assert.equal(await page.locator('body').getAttribute('data-scenario-app-version'),APP_VERSION);
    await run(page);checks.push({name,status:'passed'});console.log('PASS',name);
  } catch(error) {
    checks.push({name,status:'failed',error:error.stack||error.message});console.error('FAIL',name,error.message);
    await page?.screenshot({path:path.join(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});
  } finally {video=page?.video();await context?.close();if(record&&video)await video.saveAs(path.join(out,'methanol-m01-actual-playback.webm'));}
}
async function three(page,adapter='kimi-m01') {
  await page.locator('#view-3d').click();await host(page).locator('canvas').waitFor({timeout:60000});
  await page.waitForFunction(adapter=>document.getElementById('view-3d-host').dataset.visualAdapter===adapter,adapter,{timeout:60000});
  assert.equal(await page.locator('#export-png').isEnabled(),true);
}
async function seek(page,value) {
  await page.locator('#timeline').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  assert.equal(await clock(page),'0');
}
async function output(page) {const details=page.locator('#comparison-output');if(await details.getAttribute('open')===null)await details.locator('summary').click();}
async function download(page,id,name,{outputPanel=false}={}) {
  if(outputPanel)await output(page);
  const [file]=await Promise.all([page.waitForEvent('download',{timeout:180000}),page.locator(id).click({timeout:id==='#export-png'?180000:30000})]);
  assert.equal(await file.failure(),null);const dest=path.join(out,name);await file.saveAs(dest);return fs.readFile(dest);
}
const project=async(page,name)=>JSON.parse((await download(page,'#json',name,{outputPanel:true})).toString());
async function chooseMaterial(page,id) {
  await page.locator('#edit-material').click();await page.locator('#editor-dialog').waitFor();await page.locator('#panel-material-select').selectOption(id);await page.locator('#apply-change').click();await page.locator('#editor-dialog').waitFor({state:'hidden'});
}
async function loadPreset(page,id) {
  const details=page.locator('#preset-gallery').locator('..');if(await details.getAttribute('open')===null)await details.locator('summary').click();
  await page.locator(`[data-preset-id="${id}"]`).click();await page.locator('#editor-dialog').waitFor();assert.equal(await page.locator('#panel-preset-select').inputValue(),id);await page.locator('#apply-change').click();await page.locator('#editor-dialog').waitFor({state:'hidden'});
}
async function screenshot(page,name) {await host(page).evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const png=await host(page).screenshot({path:path.join(out,name)});visualEvidence.push(imageContent(png,name));}

await check('M01 six-stage preview, camera choices and true unified-clock playback',async page=>{
  assert.equal(await page.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v2')),null);
  await three(page);assert.equal(await clock(page),'0');await page.locator('#show-labels').uncheck();
  for(let i=0;i<6;i++) {
    await page.locator(`#stages [data-stage="${i}"]`).click();
    assert.ok(Math.abs(Number(await page.locator('#timeline').inputValue())-(i+.2)/6)<.0011);assert.equal(await clock(page),'0');
    await screenshot(page,`m01-stage-${i+1}.png`);
  }
  await seek(page,.7);const first=await host(page).locator('canvas').screenshot();await seek(page,.94);await seek(page,.7);assert.deepEqual(await host(page).locator('canvas').screenshot(),first,'backward seek reproduces the same rendered pixels');
  for(const camera of ['overview','tank','leak','pool','top']){await page.locator('#camera-select').selectOption(camera);await screenshot(page,`m01-camera-${camera}.png`);}
  await page.locator('#camera-select').selectOption('overview');await page.locator('#speed').selectOption('2');await seek(page,0);await page.locator('#replay').click();
  await page.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1');
  await page.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='0',{},{timeout:60000});
  assert.equal(Number(await page.locator('#timeline').inputValue()),1);assert.equal(await host(page).getAttribute('data-active-loops'),'0');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v2')),null,'example view must not save over a draft');
},{record:true});

await check('M01 same-geometry material changes rebuild the visual adapter while retaining current conditions and frozen A',async page=>{
  await page.locator('#modify-scene').click();await three(page);await seek(page,.7);await output(page);await page.locator('#freeze').click();
  const original=await project(page,'m01-frozen-original.json'),trend=[];
  for(const id of ['ethanol','methanol','n-heptane','methanol']) {
    await chooseMaterial(page,id);await three(page,id==='methanol'?'kimi-m01':'native');await seek(page,.7);
    const current=await project(page,`m01-switch-${id}-${trend.length}.json`);
    assert.deepEqual(current.inputs.equipment,original.inputs.equipment);assert.deepEqual(current.inputs.storage,original.inputs.storage);assert.deepEqual(current.comparison,original.comparison);
    trend.push({...await host(page).evaluate(el=>({...el.dataset})),material:id});
  }
  assert.ok(Number(trend.at(-1).equipmentBuilds)>Number(trend[0].equipmentBuilds));
  assert.equal(Number(trend.at(-1).rendererCount),1);assert.equal(await clock(page),'0');resources.push({materialTransitions:trend});
});

await check('M01 native-resolution PNG exports preserve the exact scene, camera, inputs and single-clock state',async page=>{
  await three(page);await seek(page,.73);await page.locator('#camera-select').selectOption('pool');await page.locator('#visual-mode').selectOption('natural');await page.locator('#show-labels').uncheck();
  const original=await project(page,'m01-before-png.json'),posts=await page.evaluate(()=>window.__qaWorkerPosts),canvas=host(page).locator('canvas'),dimensions=await canvas.evaluate(el=>[el.width,el.height]),metas=[];
  for(const size of ['1920x1080','2048x1152']) {
    await page.locator('#png-size').selectOption(size);const png=await download(page,'#export-png',`m01-${size}.png`);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],size.split('x').map(Number));assert.ok(png.length>30000);
    visualEvidence.push(imageContent(png,`m01-${size}.png`));
    await page.waitForFunction(()=>!document.getElementById('export-frame-meta').disabled);
    const meta=JSON.parse((await download(page,'#export-frame-meta',`m01-${size}-metadata.json`)).toString());
    assert.equal(meta.appVersion,APP_VERSION);assert.equal(meta.visualAdapter,'kimi-m01');assert.equal(meta.scenario.id,'pool-fire');assert.equal(meta.material.id,'methanol');assert.equal(meta.assisted,false);assert.equal(meta.progress,.73);assert.equal(meta.inputRevision,original.inputRevision);assert.equal(meta.camera.preset,'pool');assert.equal(meta.pixels,'actual-3d-high-resolution-rerender');
    assert.deepEqual(await canvas.evaluate(el=>[el.width,el.height]),dimensions);metas.push(meta);
  }
  assert.deepEqual(metas[0].sourceCamera,metas[1].sourceCamera);assert.equal(await page.evaluate(()=>window.__qaWorkerPosts),posts);assert.equal(await clock(page),'0');
  const after=await project(page,'m01-after-png.json');assert.deepEqual(after.inputs,original.inputs);assert.equal(after.inputRevision,original.inputRevision);
});

await check('M01 old local draft bytes and independent frozen A survive the new visual path',async page=>{
  assert.equal(await page.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v011-original')),raw);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v2')),raw);
  await page.locator('#continue-draft').click();const current=await project(page,'m01-old-draft.json'),old=JSON.parse(raw);
  // V0.2.0 already introduced the missing confined condition as unknown. That
  // schema normalization is not a change of an old user's entered condition.
  old.inputs.scenario.conditions.confined??='unknown';old.comparison.project.inputs.scenario.conditions.confined??='unknown';
  assert.deepEqual(current.inputs,old.inputs);assert.deepEqual(current.comparison.project.inputs,old.comparison.project.inputs);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v011-original')),raw);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-tool-sentinel')),'keep');
},{legacy:true});

await check('M01 transition to a native non-pool preset and back retains one renderer and one clock',async page=>{
  const trend=[];
  for(const id of [primary,'propane-gas-pipeline-jet-fire',primary,'propane-cabinet-confined-deflagration',primary]) {
    await loadPreset(page,id);await three(page,id===primary?'kimi-m01':'native');await seek(page,.7);trend.push({preset:id,...await host(page).evaluate(el=>({...el.dataset}))});
    assert.equal(Number(trend.at(-1).rendererCount),1);assert.equal(Number(trend.at(-1).activeLoops),0);assert.equal(await clock(page),'0');
  }
  const repeated=trend.filter(item=>item.preset===primary);assert.ok(Number(repeated.at(-1).geometries)<=Number(repeated[0].geometries)+5);assert.ok(Number(repeated.at(-1).textures)<=Number(repeated[0].textures)+5);resources.push({sceneTransitions:trend});
});

await check('M01 real shader compilation failure visibly falls back to editable 2D, never an empty successful 3D',async page=>{
  const before=await project(page,'m01-before-shader-failure.json');await page.locator('#view-3d').click();
  await page.waitForFunction(()=>/不可用|失败|错误/.test(document.getElementById('view-status').textContent),{},{timeout:60000});
  assert.equal(page.__qaShaderInjected,true);assert.equal(await page.locator('#view-2d-host svg').isVisible(),true);assert.equal(await host(page).isVisible(),false);assert.equal(await page.locator('#export-png').isDisabled(),true);assert.equal(await clock(page),'0');
  const after=await project(page,'m01-after-shader-failure.json');assert.deepEqual(after.inputs,before.inputs);assert.equal(after.inputRevision,before.inputRevision);
  await page.screenshot({path:path.join(out,'intentional-shader-failure-2d.png'),fullPage:true});
},{shaderFailure:true});

const sameOrigin=requests.every(request=>request.method==='GET'&&new URL(request.url).origin===new URL(base).origin&&!/\/api\/|analytics|auth\.js/.test(request.url));
checks.push({name:'M01 isolated browser privacy and unexpected-script-error check',status:sameOrigin&&errors.length===0?'passed':'failed'});
await browser.close();
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({appVersion:APP_VERSION,scope:'Real built-page actions in isolated synthetic fixture contexts; nonempty pixel content and shader console checks included; the dedicated shader-failure case deliberately changes one GLSL token and records expected diagnostics separately; screenshots/video are actual application frames; not real-phone performance, external-user review or engineering validation',checks,errors,expectedShaderDiagnostics,requests,resources,visualEvidence},null,2));
if(checks.some(check=>check.status!=='passed'))process.exitCode=1;

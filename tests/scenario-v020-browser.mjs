import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url)),pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:pathToFileURL(require.resolve('playwright')).href),{chromium}=pw.default||pw;
const base=(process.env.SCENARIO_BASE_URL||'http://127.0.0.1:8786').replace(/\/$/,''),out=path.resolve(process.env.SCENARIO_V020_QA_DIR||'test-results/scenario-v020');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']}),checks=[],errors=[],requests=[],resources=[];
const cases=[
 {id:'methanol-atmospheric-tank-pool-fire',scenario:'pool-fire',material:'methanol',record:'pool-fire'},
 {id:'n-heptane-atmospheric-tank-pool-fire',scenario:'pool-fire',material:'n-heptane'},
 {id:'propane-gas-pipeline-jet-fire',scenario:'jet-fire',material:'propane',record:'jet-fire'},
 {id:'propane-gas-pipeline-flash-fire',scenario:'flash-fire',material:'propane',record:'flash-fire'},
 {id:'propane-gas-pipeline-vce',scenario:'vce',material:'propane',record:'vce'},
 {id:'propane-cabinet-confined-deflagration',scenario:'confined-deflagration',material:'propane',record:'confined-deflagration'},
];
async function check(name,fn,options={}){
 let context,page,video;
 try{
  context=await browser.newContext({viewport:options.viewport||{width:1440,height:1000},acceptDownloads:true,...(options.record?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1440,height:1000}}}:{})});page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push({test:name,message:e.message}));page.on('console',m=>{if(m.type()==='error'&&!(options.fail3d&&m.location().url.includes('view-3d-')&&/ERR_FAILED|Failed to fetch/.test(m.text())))errors.push({test:name,message:m.text()});});page.on('request',r=>requests.push({test:name,url:r.url(),method:r.method(),body:r.postData()}));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{window.__qaWorkerPosts=0;const Native=window.Worker;window.Worker=class extends Native{postMessage(...args){window.__qaWorkerPosts++;return super.postMessage(...args);}};});
  if(options.fail3d)await page.route('**/view-3d-*.mjs',r=>r.abort());await page.goto(base+'/tools/scenario-workbench.html',{waitUntil:'networkidle'});await page.locator('#workspace').waitFor();assert.equal(await page.locator('body').getAttribute('data-scenario-app-version'),'0.2.0');
  await fn(page);checks.push({name,status:'passed'});console.log('PASS',name);
 }catch(e){checks.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message);await page?.screenshot({path:path.join(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});}
 finally{video=page?.video();await context?.close();if(options.record&&video)await video.saveAs(path.join(out,options.record+'-actual-playback.webm'));}
}
async function load(p,item){const details=p.locator('#preset-gallery').locator('..');if((await details.getAttribute('open'))===null)await details.locator('summary').click();await p.locator(`[data-preset-id="${item.id}"]`).click();await p.locator('#editor-dialog').waitFor();assert.equal(await p.locator('#panel-preset-select').inputValue(),item.id);await p.locator('#apply-change').click();await p.locator('#editor-dialog').waitFor({state:'hidden'});}
async function three(p,item){await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();await p.waitForFunction(({scene,material})=>{const el=document.getElementById('view-3d-host');return el.dataset.sceneId===scene&&el.dataset.materialId===material&&el.dataset.renderer==='volumetric-raymarch';},{scene:item.scenario,material:item.material});assert.equal(await p.locator('#view-2d-host').isVisible(),false);}
async function seek(p,value){await p.locator('#timeline').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'0');}
async function shot(p,name){await p.locator('#view-3d-host').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await p.locator('#view-3d-host').screenshot({path:path.join(out,name)});}
async function output(p){const el=p.locator('#comparison-output');if((await el.getAttribute('open'))===null)await el.locator('summary').first().click();}
async function download(p,id,name,{isOutput=false}={}){if(isOutput)await output(p);const [d]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.locator(id).click({timeout:id==='#export-png'?120000:30000})]);assert.equal(await d.failure(),null);const dest=path.join(out,name);await d.saveAs(dest);return fs.readFile(dest);}
const project=async(p,name)=>JSON.parse((await download(p,'#json',name,{isOutput:true})).toString('utf8'));
function pngSize(b){assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
const rev=async p=>Number(await p.locator('#workspace').getAttribute('data-input-revision'));
const workerPosts=p=>p.evaluate(()=>window.__qaWorkerPosts);

for(const item of cases)await check('R01/04-11: independent 3D '+item.id,async p=>{
 await load(p,item);await three(p,item);assert.equal(await p.locator('#view-3d-host').getAttribute('data-renderer'),'volumetric-raymarch');assert.ok(Number(await p.locator('#view-3d-host').getAttribute('data-ray-steps'))>=24);
 if(item.scenario==='confined-deflagration')await p.locator('#cutaway').check();
 for(const at of [.22,.50,.74,.94]){await seek(p,at);await shot(p,`${item.id}-${String(at).replace('.','p')}.png`);assert.ok((await p.locator('#view-3d-host .sc-visual-label:visible').count())<=3,'compact label mode');}
 const data=await project(p,item.id+'.json');assert.equal(data.inputs.material.id,item.material);assert.equal(data.inputs.scenario.id,item.scenario);assert.equal(data.meta.schemaVersion,'1.1.0');assert.match(await p.locator('#support-note').innerText(),/预设|视觉|教学/);
 if(item.record){const details=p.locator('#comparison-output');if((await details.getAttribute('open'))!==null)await details.locator('summary').first().click();await p.locator('#speed').selectOption('2');await seek(p,0);await p.locator('#view-3d-host').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await p.locator('#replay').click();await p.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1');await p.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='0',{},{timeout:60000});assert.equal(Number(await p.locator('#timeline').inputValue()),1);}
 resources.push({preset:item.id,...await p.locator('#view-3d-host').evaluate(el=>({...el.dataset}))});
},{record:item.record});

await check('R12/16/18: display controls and two native-resolution PNGs preserve inputs, task count and camera',async p=>{
 const item=cases[5];await load(p,item);await three(p,item);await seek(p,.73);const revision=await rev(p),posts=await workerPosts(p),steps=[];
 for(const quality of ['low','balanced','high']){await p.locator('#quality').selectOption(quality);assert.equal(await p.locator('#view-3d-host').getAttribute('data-quality'),quality);steps.push(Number(await p.locator('#view-3d-host').getAttribute('data-ray-steps')));}assert.ok(steps[0]<steps[1]&&steps[1]<steps[2]);await p.locator('#quality').selectOption('balanced');
 const before=await p.locator('#view-3d-host canvas').screenshot();await p.locator('#cutaway').check();assert.notDeepEqual(await p.locator('#view-3d-host canvas').screenshot(),before);assert.equal(await p.locator('#pressure-aux').isChecked(),false);await p.locator('#pressure-aux').check();await p.locator('#camera-select').selectOption('leak');await p.locator('#visual-mode').selectOption('natural');await p.locator('#label-detail').check();await p.locator('#show-labels').uncheck();
 const dimensions=await p.locator('#view-3d-host canvas').evaluate(el=>({width:el.width,height:el.height})),metas=[];
 for(const size of ['1920x1080','2048x1152']){await p.locator('#png-size').selectOption(size);const png=await download(p,'#export-png',`confined-${size}.png`);assert.deepEqual(pngSize(png),size.split('x').map(Number));assert.ok(png.byteLength>50000);await p.waitForFunction(()=>!document.getElementById('export-frame-meta').disabled);const meta=JSON.parse((await download(p,'#export-frame-meta',`confined-${size}-metadata.json`)).toString('utf8'));assert.equal(meta.appVersion,'0.2.0');assert.equal(meta.scenario.id,'confined-deflagration');assert.equal(meta.material.id,'propane');assert.equal(meta.assisted,false);assert.equal(meta.cutaway,true);assert.equal(meta.pressureAux,true);assert.equal(meta.inputRevision,revision);assert.equal(meta.progress,.73);assert.equal(meta.pixels,'actual-3d-high-resolution-rerender');assert.equal(meta.camera.preset,'leak');assert.equal(meta.width,Number(size.split('x')[0]));assert.equal(meta.height,Number(size.split('x')[1]));metas.push(meta);assert.deepEqual(await p.locator('#view-3d-host canvas').evaluate(el=>({width:el.width,height:el.height})),dimensions);}
 assert.deepEqual(metas[0].sourceCamera,metas[1].sourceCamera);assert.equal(await rev(p),revision);assert.equal(await workerPosts(p),posts);assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'0');await p.locator('#fullscreen').click();await p.waitForFunction(()=>document.getElementById('fullscreen').getAttribute('aria-pressed')==='true');await p.locator('#fullscreen').click();await p.waitForFunction(()=>document.getElementById('fullscreen').getAttribute('aria-pressed')==='false');assert.equal(await rev(p),revision);assert.equal(await workerPosts(p),posts);
});

await check('R13/14: twenty complete-scene changes retain last state and bounded live renderer resources',async p=>{
 const trend=[];for(let i=0;i<20;i++){const item=cases[i%cases.length];await load(p,item);await three(p,item);await seek(p,.70);const entry={index:i,preset:item.id,...await p.locator('#view-3d-host').evaluate(el=>({...el.dataset}))};trend.push(entry);assert.equal(Number(entry.rendererCount),1);assert.ok(Number(await p.locator('#workspace').getAttribute('data-active-clocks'))<=1);}
 const final=await project(p,'twenty-changes-final.json');assert.equal(final.inputs.material.id,cases[19%6].material);assert.equal(final.inputs.scenario.id,cases[19%6].scenario);const repeated=trend.filter(x=>x.preset===cases[0].id);assert.ok(Number(repeated.at(-1).geometries)<=Number(repeated[0].geometries)+8);assert.ok(Number(repeated.at(-1).textures)<=Number(repeated[0].textures)+8);resources.push({continuousChanges:trend});
});

for(const width of [360,390])await check(`R20: ${width}px scene-selection, cutaway, keyboard and export`,async p=>{
 const item=cases[5];await load(p,item);await three(p,item);await p.locator('#quality').selectOption('low');await p.locator('#cutaway').check();await seek(p,.72);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(p,`mobile-${width}-confined.png`);await p.locator('#edit-storage').click();await p.locator('#panel-quantity').fill('12');await p.locator('#apply-change').focus();await p.keyboard.press('Enter');await p.locator('#editor-dialog').waitFor({state:'hidden'});const data=await project(p,`mobile-${width}-project.json`);assert.equal(data.inputs.material.id,'propane');assert.equal(data.inputs.scenario.id,'confined-deflagration');assert.equal(data.inputs.storage.inventoryKg,12);assert.equal(data.ui.quality,'low');assert.equal(data.ui.cutaway,true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#export-png').isEnabled(),true);
},{viewport:{width,height:844}});

await check('R19: failed WebGL module preserves current non-pool 2D/edit/JSON',async p=>{
 await load(p,cases[5]);await p.locator('#view-3d').click();await p.waitForFunction(()=>/不可用|失败/.test(document.getElementById('view-status').textContent));assert.equal(await p.locator('#view-2d-host svg').isVisible(),true);const data=await project(p,'blocked-3d-confined.json');assert.equal(data.inputs.scenario.id,'confined-deflagration');assert.equal(data.inputs.material.id,'propane');assert.equal(await p.locator('#export-png').isEnabled(),false);
},{fail3d:true});

checks.push({name:'R22/privacy: no unexpected errors, project uploads or cross-origin requests',status:errors.length===0&&requests.every(r=>new URL(r.url).origin===new URL(base).origin&&r.method==='GET'&&!/api\/|analytics|auth\.js/.test(r.url))?'passed':'failed'});
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({browser:await browser.version(),headless:true,device:'macOS desktop Chromium software GPU; viewport emulation is not real mobile hardware',recordings:'Playwright recordVideo of actual application requestAnimationFrame playback at 2x teaching speed; not stitched screenshots',checks,errors,requests,resources,externalUsers:'not_run',realMobile:'not_run'},null,2));await browser.close();if(checks.some(c=>c.status!=='passed'))process.exitCode=1;

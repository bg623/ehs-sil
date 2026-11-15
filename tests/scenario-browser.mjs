import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url));
const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:pathToFileURL(require.resolve('playwright')).href);
const {chromium}=pw.default||pw;
const base=(process.env.SCENARIO_BASE_URL||'http://127.0.0.1:8786').replace(/\/$/,''),out=path.resolve(process.env.SCENARIO_QA_DIR||'test-results/scenario-v011');
await fs.mkdir(out,{recursive:true});
const legacyRaw=await fs.readFile(new URL('./fixtures/scenario-v1-project.json',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']});
const checks=[],requests=[],errors=[],resourceTrend=[],v1='ehs-sil-scenario-project-v1',v2='ehs-sil-scenario-project-v2',previousKey='ehs-sil-scenario-previous-v2';
let activePage;
async function check(name,fn,options={}){
 let context;
 try{
  context=await browser.newContext({viewport:options.viewport||{width:1440,height:1000},acceptDownloads:true,...(options.reducedMotion?{reducedMotion:options.reducedMotion}:{})});
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push({test:name,message:e.message}));
  page.on('console',m=>{if(m.type()==='error'&&!(options.fail3d&&m.location().url.includes('view-3d-')&&/ERR_FAILED|Failed to fetch/.test(m.text())))errors.push({test:name,message:m.text()});});
  page.on('request',r=>requests.push({test:name,url:r.url(),method:r.method(),body:r.postData()}));page.on('dialog',d=>d.accept());
  await page.addInitScript(({initialStorage,denyWrites,delayedWorker})=>{
   window.print=()=>{};localStorage.setItem('ehs-sil-moc-record-v1','sentinel');
   for(const[k,v]of Object.entries(initialStorage||{}))localStorage.setItem(k,v);
   if(denyWrites)Storage.prototype.setItem=function(){throw new DOMException('QA quota','QuotaExceededError');};
   const NativeWorker=window.Worker;window.__qaWorkerPosts=0;window.Worker=class extends NativeWorker{postMessage(...args){window.__qaWorkerPosts++;return super.postMessage(...args);}set onmessage(fn){super.onmessage=delayedWorker?e=>{const old=e.data?.result?.inputRevision===1;setTimeout(()=>{if(old)window.__qaOldWorkerDelivered=true;fn.call(this,e);},old?2500:0);}:fn;}};
  },options);
  if(options.fail3d)await page.route('**/view-3d-*.mjs',r=>r.abort());
  await page.goto(base+'/tools/scenario-workbench.html',{waitUntil:'networkidle'});await page.locator('#workspace').waitFor();
  assert.ok(await page.locator('[data-scenario-app-version="0.1.1"]').count(),'actual app version marker');
  await fn(page);checks.push({name,status:'passed'});console.log('PASS',name);
 }catch(e){checks.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message);await activePage?.screenshot({path:path.join(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});}
 finally{await context?.close();}
}
const shot=(p,n)=>p.screenshot({path:path.join(out,n),fullPage:true});
async function viewShot(p,name){const host=p.locator('#view-3d-host');await host.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await host.screenshot({path:path.join(out,name)});}
async function output(p){const d=p.locator('#comparison-output');if(await d.count()&&(await d.getAttribute('open'))===null)await d.locator('summary').first().click();}
async function download(p,id,name){await output(p);const wait=p.waitForEvent('download');await p.locator(id).click();const d=await wait,dest=path.join(out,name);await d.saveAs(dest);assert.equal(await d.failure(),null);return fs.readFile(dest,'utf8');}
const project=async(p,name='project.json')=>JSON.parse(await download(p,'#json',name));
async function edit(p,type){await p.locator('#edit-'+type).click();await p.locator('#editor-dialog').waitFor();}
async function apply(p){await p.locator('#apply-change').click();await p.locator('#editor-dialog').waitFor({state:'hidden'});}
async function choose(p,type,id){await edit(p,type);await p.locator('#panel-'+type+'-select').selectOption(id);await apply(p);}
async function checkResult(p){const details=p.locator('#check').locator('..');if((await details.getAttribute('open'))===null)await details.locator('summary').first().click();await p.locator('#check').click();await p.waitForFunction(()=>/仅教学演示/.test(document.getElementById('result-state').textContent));}
const revision=async p=>Number(await p.locator('#workspace').getAttribute('data-input-revision'));
const progress=(p,v)=>p.locator('#timeline').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},v);

await check('UX01: full methanol template, no personal-draft write and actual interactive 3D',async p=>{
 assert.match(await p.locator('#bar-material').innerText(),/甲醇/);assert.match(await p.locator('#bar-storage').innerText(),/30/);assert.equal(await p.evaluate(k=>localStorage.getItem(k),v2),null);
 await shot(p,'first-screen.png');await p.locator('#play-example').click();await p.locator('#view-3d-host canvas').waitFor();await p.waitForFunction(()=>Number(document.getElementById('view-3d-host').dataset.frames)>4);
 assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'1');await p.locator('#play').click();assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'0');await progress(p,.68);
 assert.match(await p.locator('#visual-note').innerText(),/增强轮廓|可见性辅助/);await viewShot(p,'methanol-assisted-3d.png');
 const canvas=p.locator('#view-3d-host canvas'),before=await canvas.screenshot(),box=await canvas.boundingBox();await p.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:12});await p.mouse.up();assert.notDeepEqual(await canvas.screenshot(),before);
});
await check('UX02/03/09: modify inherits complete example; preview/cancel/apply/undo preserve conditions',async p=>{
 await p.locator('#modify-scene').click();const a=await project(p,'inherited-methanol.json');assert.equal(a.inputs.material.id,'methanol');assert.equal(a.inputs.storage.volumeM3,30);assert.equal(a.inputs.storage.inventoryKg,null);assert.equal(a.inputs.material.temperatureK,293.15);assert.equal(a.inputs.storage.pressurePa,101325);
 await edit(p,'material');await p.locator('#panel-material-select').selectOption('ethanol');assert.match(await p.locator('#change-summary').innerText(),/保留/);await p.locator('#cancel-change').click();const cancelled=await project(p,'cancelled.json');assert.equal(cancelled.inputRevision,a.inputRevision);assert.deepEqual(cancelled.inputs,a.inputs);
 await choose(p,'material','ethanol');const b=await project(p,'ethanol-preserves-conditions.json');assert.equal(b.inputs.material.id,'ethanol');assert.equal(b.inputs.storage.volumeM3,30);assert.equal(b.inputs.storage.inventoryKg,null);assert.deepEqual(b.inputs.equipment,a.inputs.equipment);assert.equal(b.inputs.storage.pressurePa,101325);assert.equal(b.inputs.material.temperatureK,293.15);assert.equal(b.inputRevision,a.inputRevision+1);
 await shot(p,'material-replacement.png');await p.locator('#undo').click();const back=await project(p,'undo.json');assert.equal(back.inputs.material.id,'methanol');assert.equal(back.inputRevision,b.inputRevision+1);
});
await check('UX04/06: mass/volume/fill basis and temperature/absolute-pressure units',async p=>{
 await p.locator('#modify-scene').click();await edit(p,'storage');await p.locator('#panel-basis').selectOption('mass');await p.locator('#panel-quantity').fill('20000');await p.locator('#panel-temperature').fill('25');await p.locator('#panel-pressure-mode').selectOption('absolute');await p.locator('#panel-pressure').fill('110');await apply(p);
 await choose(p,'material','ethanol');let data=await project(p,'mass-basis.json');assert.equal(data.inputs.storage.quantityBasis,'mass');assert.equal(data.inputs.storage.inventoryKg,20000);assert.equal(data.inputs.storage.volumeM3,null);assert.equal(data.inputs.storage.fillFraction,null);assert.equal(data.inputs.material.temperatureK,298.15);assert.equal(data.inputs.storage.pressurePa,110000);
 await edit(p,'storage');await p.locator('#panel-temperature').fill('');await p.locator('#panel-pressure-mode').selectOption('unknown');await p.locator('#panel-pressure').fill('');await apply(p);data=await project(p,'unknown-not-zero.json');assert.equal(data.inputs.material.temperatureK,null);assert.equal(data.inputs.storage.pressurePa,null);
});
await check('UX05/08: equipment replacement preserves inventory and exposes overcapacity',async p=>{
 await p.locator('#modify-scene').click();await choose(p,'equipment','small-vertical-atmospheric');let data=await project(p,'small-tank.json');assert.equal(data.inputs.material.id,'methanol');assert.equal(data.inputs.storage.volumeM3,30);assert.equal(data.inputs.equipment.geometry.diameterM,3);assert.equal(data.inputs.equipment.geometry.heightM,2.5);assert.match(await p.locator('#support-note').innerText(),/容量|超过|机制/);await shot(p,'capacity-warning.png');
 await edit(p,'storage');await p.locator('#panel-basis').selectOption('fill');await p.locator('#panel-quantity').fill('60');await apply(p);data=await project(p,'fill-basis.json');assert.equal(data.inputs.storage.fillFraction,.6);assert.equal(data.inputs.storage.volumeM3,null);
});
await check('UX07/VI05/EX01: non-pool mechanisms retain material/conditions and never reuse pool stages',async p=>{
 await p.locator('#modify-scene').click();for(const id of ['jet-fire','flash-fire','vce','bleve','toxic']){await choose(p,'scenario',id);assert.equal(await p.locator('#view-2d-host svg').isVisible(),true);assert.equal(await p.locator('#view-3d-host canvas').isVisible().catch(()=>false),false);assert.match((await p.locator('#support-note').innerText())+' '+(await p.locator('#view-status').innerText()),/机制|3D|三维/);assert.ok(!/液池点火|形成液池|液池形成/.test(await p.locator('#stage-title').innerText()));const data=await project(p,`mechanism-${id}.json`);assert.equal(data.inputs.material.id,'methanol');assert.equal(data.inputs.storage.volumeM3,30);assert.equal(data.inputs.storage.pressurePa,101325);assert.equal(data.inputs.scenario.id,id);}
 await shot(p,'non-pool-mechanism.png');const text=await download(p,'#csv','toxic-current.csv');assert.match(text,/毒性|toxic/i);assert.match(text,/未评估/);await p.locator('#print').click();const report=await p.locator('#print-report').innerText();assert.match(report,/毒性|Toxic/);assert.ok(!report.includes('pool-fire-teaching'));
});
await check('ST01: delayed real-Worker message cannot overwrite the newest material result',async p=>{
 await p.locator('#modify-scene').click();await choose(p,'material','ethanol');await checkResult(p);const rev=await revision(p);await p.waitForFunction(()=>window.__qaOldWorkerDelivered===true);assert.equal(await revision(p),rev);assert.match(await p.locator('#bar-material').innerText(),/乙醇/);assert.equal((await project(p,'late-worker.json')).inputs.material.id,'ethanol');assert.match(await p.locator('#result-state').innerText(),/教学/);
},{delayedWorker:true});
await check('ST02/VI03/04: camera, speed and natural/assisted visibility do not invalidate or rerun analysis',async p=>{
 await p.locator('#modify-scene').click();await checkResult(p);const rev=await revision(p),workerPosts=await p.evaluate(()=>window.__qaWorkerPosts);await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();await progress(p,.7);await p.locator('#visual-mode').selectOption('natural');assert.match(await p.locator('#visual-note').innerText(),/外观示意.*非实测/);await viewShot(p,'methanol-natural-3d.png');
 await p.locator('#camera-select').selectOption('pool');await p.locator('#show-labels').uncheck();await p.locator('#visual-mode').selectOption('assisted');await viewShot(p,'methanol-assisted-pool-unlabelled.png');await p.locator('#visual-mode').selectOption('natural');await viewShot(p,'methanol-natural-pool-unlabelled.png');
 for(const camera of ['tank','leak','pool','top','overview'])await p.locator('#camera-select').selectOption(camera);await p.locator('#speed').selectOption('2');assert.equal(await revision(p),rev);await p.locator('#visual-mode').selectOption('assisted');await p.locator('#show-labels').uncheck();assert.match(await p.locator('#visual-note').innerText(),/增强轮廓|可见性辅助/);assert.equal(await revision(p),rev);assert.equal(await p.evaluate(()=>window.__qaWorkerPosts),workerPosts);const data=await project(p,'display-preferences.json');assert.equal(data.ui.visualMode,'assisted');assert.equal(data.ui.camera,'overview');assert.equal(data.ui.speed,2);assert.equal(data.ui.labels,false);const saved=JSON.parse(await p.evaluate(k=>localStorage.getItem(k),v2));assert.deepEqual(saved.ui,data.ui);
});
await check('EX03/UX10: frozen A survives B changes, full-preset replacement and previous-draft recovery',async p=>{
 await p.locator('#modify-scene').click();await checkResult(p);await output(p);await p.locator('#freeze').click();const a=await project(p,'comparison-a.json');assert.equal(a.comparison.project.inputs.material.id,'methanol');await choose(p,'material','ethanol');const b=await project(p,'comparison-b.json');assert.deepEqual(b.comparison,a.comparison);assert.equal(b.inputs.material.id,'ethanol');assert.match(await p.locator('#comparison').innerText(),/乙醇|ethanol/);
 await p.locator('#load-preset').click();await p.locator('#panel-preset-select').selectOption('methanol-atmospheric-tank-pool-fire');await apply(p);const reset=await project(p,'preset-retains-a.json');assert.equal(reset.inputs.material.id,'methanol');assert.deepEqual(reset.comparison,a.comparison);await p.locator('#restore-previous').click();const back=await project(p,'previous-draft.json');assert.equal(back.inputs.material.id,'ethanol');assert.deepEqual(back.comparison,a.comparison);await shot(p,'comparison.png');
});
await check('DA01: legacy identity, mass and independently frozen A migrate without changing original bytes',async p=>{
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),v1),legacyRaw);assert.ok(await p.evaluate(k=>localStorage.getItem(k),v2));await p.locator('#continue-draft').click();const data=await project(p,'legacy-migrated.json');assert.equal(data.inputs.material.id,'teaching-a');assert.equal(data.inputs.material.cas,null);assert.equal(data.inputs.storage.quantityBasis,'mass');assert.equal(data.inputs.storage.inventoryKg,1000);assert.equal(data.inputs.storage.volumeM3,null);assert.equal(data.inputs.material.temperatureK,311.15);assert.equal(data.inputs.storage.pressurePa,187000);assert.equal(data.comparison.project.inputs.storage.inventoryKg,750);assert.equal(data.comparison.project.inputs.material.temperatureK,298.15);assert.equal(await p.evaluate(k=>localStorage.getItem(k),v1),legacyRaw);await shot(p,'legacy-migration.png');
},{initialStorage:{[v1]:legacyRaw}});
await check('DA04: restore previous Q from example mode does not replace it with current draft P',async p=>{
 const sample=await project(p,'recovery-seed.json'),current=structuredClone(sample),previous=structuredClone(sample);
 current.meta.id='qa-current-P';current.meta.title='当前草稿 P';current.inputs.storage.volumeM3=17;current.evidenceNotes='当前记录 P，不应覆盖先前的 Q';current.inputRevision=5;
 previous.meta.id='qa-previous-Q';previous.meta.title='上一个草稿 Q';previous.inputs.storage.volumeM3=9;previous.evidenceNotes='这是必须恢复的 Q';previous.inputRevision=3;
 await p.evaluate(({current,previous,v2,previousKey})=>{localStorage.setItem(v2,JSON.stringify(current));localStorage.setItem(previousKey,JSON.stringify(previous));},{current,previous,v2,previousKey});
 await p.reload({waitUntil:'networkidle'});await p.locator('#workspace').waitFor();assert.match(await p.locator('#mode-label').innerText(),/教学示例/);assert.match(await p.locator('#bar-storage').innerText(),/30/);
 await p.locator('#restore-previous').click();const restored=await project(p,'restore-previous-Q.json');assert.equal(restored.meta.id,previous.meta.id);assert.equal(restored.meta.title,previous.meta.title);assert.equal(restored.inputs.storage.volumeM3,9);assert.equal(restored.evidenceNotes,previous.evidenceNotes);assert.deepEqual(restored.inputs,previous.inputs);assert.deepEqual(restored.comparison,previous.comparison);assert.deepEqual(JSON.parse(await p.evaluate(k=>localStorage.getItem(k),v2)).inputs,previous.inputs);
});
await check('DA05: quantity-only common edit preserves distinct controls and all user assumptions',async p=>{
 const legacy=JSON.parse(legacyRaw);legacy.controls=[{type:'有效隔离 / 切断',target:'QA 管段 A',boundary:'QA 隔离边界 A',actionTimeS:12,evidence:'QA-隔离证据-A',status:'recorded_only'},{type:'报警器 / SIS',target:'QA 储罐 B',boundary:'QA 报警边界 B',actionTimeS:45,evidence:'QA-联锁证据-B',status:'recorded_only'}];legacy.assumptions=[{text:'QA 用户假设一，应独立保留',source:'用户补充',confirmed:false},{text:'QA 用户假设二，不得被第一条合并',source:'用户补充',confirmed:false},{text:'QA 其他来源假设',source:'QA fixture',confirmed:false}];
 await output(p);await p.locator('#import-file').setInputFiles({name:'legacy-multiple-records.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await p.locator('#import-preview').waitFor();await p.locator('#restore').click();const before=await project(p,'multiple-records-before.json');assert.deepEqual(before.controls,legacy.controls);assert.deepEqual(before.assumptions,legacy.assumptions);assert.equal(before.inputs.storage.inventoryKg,1000);
 await p.locator('#quantity-value').fill('1250');await p.locator('#apply-common').click();const after=await project(p,'multiple-records-after-quantity.json');assert.equal(after.inputs.storage.inventoryKg,1250);assert.equal(after.inputRevision,before.inputRevision+1);assert.deepEqual(after.controls,before.controls);assert.deepEqual(after.assumptions,before.assumptions);assert.deepEqual(after.comparison,before.comparison);assert.equal(after.evidenceNotes,before.evidenceNotes);
});
await check('DA02: backup restore and hostile/future/oversized imports preserve the current draft',async p=>{
 await p.locator('#modify-scene').click();const a=await project(p,'import-source.json');await output(p);await p.locator('#import-file').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(a))});await p.locator('#import-preview').waitFor();await p.locator('#restore').click();const current=await project(p,'restored.json');assert.equal(current.inputs.material.id,'methanol');assert.equal(current.inputs.storage.volumeM3,30);
 for(const[name,raw]of [['broken','{'],['pollution','{"__proto__":{"approved":true}}'],['future',JSON.stringify({...a,meta:{...a.meta,schemaVersion:'9.0.0'}})],['large',' '.repeat(1048577)]]){await p.locator('#import-file').setInputFiles({name:name+'.json',mimeType:'application/json',buffer:Buffer.from(raw)});await p.waitForFunction(()=>document.getElementById('import-file').value==='');assert.match(await p.locator('#notice').innerText(),/失败|超过|不支持|拒绝/);assert.deepEqual((await project(p,`retained-${name}.json`)).inputs,current.inputs);}
 assert.equal(await p.evaluate(()=>localStorage.getItem('ehs-sil-moc-record-v1')),'sentinel');
});
await check('DA03: quota failure keeps a complete exportable in-memory project',async p=>{
 await p.locator('#modify-scene').click();await choose(p,'material','ethanol');await p.waitForFunction(()=>/失败|未保存|无法|备份/.test(document.getElementById('save-status').textContent+' '+document.getElementById('notice').textContent));const data=await project(p,'quota-memory.json');assert.equal(data.inputs.material.id,'ethanol');assert.equal(data.inputs.storage.volumeM3,30);assert.equal(await p.evaluate(()=>localStorage.getItem('ehs-sil-moc-record-v1')),'sentinel');
},{denyWrites:true});
await check('EX01/02/04: CSV/JSON/PDF represent current ethanol VCE, display mode and versions',async p=>{
 await p.locator('#modify-scene').click();await choose(p,'material','ethanol');await choose(p,'scenario','vce');await p.locator('#visual-mode').selectOption('natural');const data=await project(p,'final-current-project.json');assert.equal(data.meta.schemaVersion,'1.1.0');assert.equal(data.inputs.material.id,'ethanol');assert.equal(data.inputs.scenario.id,'vce');const text=await download(p,'#csv','current-result.csv');assert.match(text,/乙醇/);assert.match(text,/64-17-5/);assert.match(text,/m³|m3/);assert.match(text,/未评估/);await p.locator('#print').click();const html=await p.locator('#print-report').innerHTML();assert.match(html,/乙醇/);assert.match(html,/VCE|蒸气云爆炸/);assert.match(html,/自然外观|非实测/);assert.ok(!html.includes('pool-fire-teaching'));await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,'current-report.pdf'),format:'A4',printBackground:true});await p.emulateMedia({media:'screen'});await shot(p,'export-current-scene.png');
});
await check('VI06: blocked 3D resource leaves editable 2D and current exports usable',async p=>{
 await p.locator('#view-3d').click();await p.waitForFunction(()=>/不可用|失败/.test(document.getElementById('view-status').textContent));assert.equal(await p.locator('#view-2d-host svg').isVisible(),true);await p.locator('#modify-scene').click();await choose(p,'material','ethanol');assert.equal((await project(p,'fallback-project.json')).inputs.material.id,'ethanol');await shot(p,'fallback-2d.png');
},{fail3d:true});
await check('ST03/PF01: 20 replacements retain one active clock and bounded renderer geometry',async p=>{
 await p.locator('#modify-scene').click();await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();
 for(let i=0;i<20;i++){await choose(p,'material',i%2?'methanol':'ethanol');if(i%5===4){await choose(p,'scenario','vce');await choose(p,'scenario','pool-fire');await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();}resourceTrend.push({iteration:i,...await p.locator('#view-3d-host').evaluate(el=>({...el.dataset}))});assert.ok(Number(await p.locator('#workspace').getAttribute('data-active-clocks'))<=1);}
 const geometry=resourceTrend.map(x=>Number(x.geometries));assert.ok(geometry.every(Number.isFinite));assert.ok(Math.max(...geometry)-Math.min(...geometry)<=40,'same-template renderer geometry remains bounded');assert.match(await p.locator('#bar-material').innerText(),/甲醇/);assert.match(await p.locator('#bar-scenario').innerText(),/池火/);await shot(p,'resource-switch-final.png');
});
for(const width of [360,390])await check(`MB01: ${width}px play-edit-switch-export and keyboard task`,async p=>{
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('#play-example').click();await p.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1');await p.locator('#play').click();await p.locator('#view-3d-host canvas').waitFor();await progress(p,.68);await viewShot(p,`mobile-fire-${width}.png`);await p.locator('#modify-scene').click();await edit(p,'material');await p.locator('#panel-material-select').selectOption('ethanol');await p.locator('#apply-change').focus();await p.keyboard.press('Enter');await p.locator('#editor-dialog').waitFor({state:'hidden'});await edit(p,'storage');await p.locator('#panel-quantity').fill('25');await p.locator('#panel-temperature').fill('25');assert.equal(await p.locator('#apply-change').isVisible(),true);assert.equal(await p.locator('#cancel-change').isVisible(),true);await apply(p);await choose(p,'scenario','bleve');const data=await project(p,`mobile-${width}.json`);assert.equal(data.inputs.material.id,'ethanol');assert.equal(data.inputs.storage.volumeM3,25);assert.equal(data.inputs.material.temperatureK,298.15);assert.equal(data.inputs.scenario.id,'bleve');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(p,`mobile-${width}.png`);
},{viewport:{width,height:844}});
await check('reduced motion: default static, explicit playback is available',async p=>{assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'0');await p.locator('#play-example').click();await p.waitForFunction(()=>document.getElementById('workspace').dataset.activeClocks==='1');await p.locator('#play').click();},{reducedMotion:'reduce'});
checks.push({name:'GA02: same-origin static GET only, no project/API uploads or unexpected CSP/page errors',status:requests.every(r=>new URL(r.url).origin===new URL(base).origin&&r.method==='GET'&&!/auth\.js|analytics|api\/vip|membership-ui|feedback-ui/.test(r.url))&&errors.length===0?'passed':'failed',unexpectedErrors:errors});
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({browser:await browser.version(),headless:true,device:'desktop Chromium/software GPU; viewport emulation is not real mobile hardware',checks,requests,errors,resourceTrend},null,2));await browser.close();if(checks.some(c=>c.status!=='passed'))process.exitCode=1;

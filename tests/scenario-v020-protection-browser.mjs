import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('../build/scenario/package.json',import.meta.url));
const pw=await import(pathToFileURL(require.resolve('playwright')).href),{chromium}=pw.default||pw;
const base=process.env.SCENARIO_BASE_URL||'http://127.0.0.1:8786',out=path.resolve('test-results/scenario-v020-protection');
await fs.mkdir(out,{recursive:true});
const raw=await fs.readFile(new URL('./fixtures/scenario-v011-project.json',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--enable-unsafe-swiftshader']});
const checks=[],errors=[];
async function check(name,run,legacy=false){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push({name,message:e.message}));
 if(legacy)await page.addInitScript(raw=>{localStorage.setItem('ehs-sil-scenario-project-v2',raw);localStorage.setItem('other-tool-sentinel','keep');},raw);
 try{await page.goto(base+'/tools/scenario-workbench.html',{waitUntil:'networkidle'});await page.locator('#workspace').waitFor();await run(page);checks.push({name,status:'passed'});console.log('PASS',name);}catch(e){checks.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{});}finally{await context.close();}
}
async function output(p){await p.locator('#comparison-output').evaluate(el=>el.open=true);}
async function downloaded(p,id){const next=p.waitForEvent('download');await p.locator(id).click();const d=await next;const file=path.join(out,d.suggestedFilename());await d.saveAs(file);return fs.readFile(file,'utf8');}
await check('R17 original V0.1.1 byte backup and frozen A are available from the actual UI',async p=>{
 assert.equal(await p.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v011-original')),raw);
 assert.equal(await p.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v2')),raw,'example mode must not overwrite old v2');
 await output(p);assert.equal(await downloaded(p,'#original-v011-json'),raw);
 await p.locator('#continue-draft').click();const current=JSON.parse(await downloaded(p,'#json')),before=JSON.parse(raw);assert.deepEqual(current.inputs.material,before.inputs.material);assert.deepEqual(current.inputs.storage,before.inputs.storage);assert.deepEqual(current.comparison.project.inputs.material,before.comparison.project.inputs.material);
 assert.equal(await p.evaluate(()=>localStorage.getItem('ehs-sil-scenario-project-v011-original')),raw);assert.equal(await p.evaluate(()=>localStorage.getItem('other-tool-sentinel')),'keep');
},true);
await check('R19 forced WebGL context loss keeps editable 2D and the current project',async p=>{
 await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();
 const forced=await p.locator('#view-3d-host canvas').evaluate(canvas=>{const ext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});assert.equal(forced,true);
 await p.waitForFunction(()=>/WebGL.*中断/.test(document.getElementById('view-status').textContent));assert.equal(await p.locator('#view-2d-host svg').isVisible(),true);assert.equal(await p.locator('#export-png').isDisabled(),true);
 await p.locator('#edit-material').click();await p.locator('#panel-material-select').selectOption('ethanol');await p.locator('#apply-change').click();await p.locator('#editor-dialog').waitFor({state:'hidden'});await output(p);const current=JSON.parse(await downloaded(p,'#json'));assert.equal(current.inputs.material.id,'ethanol');assert.equal(current.inputs.storage.volumeM3,30);
});
await check('R16 PNG encoding failure restores 3D state and cannot expose stale frame metadata',async p=>{
 await p.locator('#view-3d').click();await p.locator('#view-3d-host canvas').waitFor();const canvas=p.locator('#view-3d-host canvas'),size=await canvas.evaluate(c=>[c.width,c.height]);
 await p.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});await p.locator('#export-png').click();await p.waitForFunction(()=>/未完成.*PNG编码失败/.test(document.getElementById('frame-export-status').textContent));assert.equal(await p.locator('#export-png').isEnabled(),true);assert.equal(await p.locator('#export-frame-meta').isDisabled(),true);assert.deepEqual(await canvas.evaluate(c=>[c.width,c.height]),size);assert.equal(await p.locator('#workspace').getAttribute('data-active-clocks'),'0');
});
await browser.close();await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,errors,scope:'Isolated test contexts; fixture data only; forced context loss is not physical-device testing'},null,2));if(checks.some(x=>x.status!=='passed')||errors.length)process.exitCode=1;

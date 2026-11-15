import {build} from 'esbuild';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'dist/scenario/v0.1.0');
await fs.mkdir(out,{recursive:true});
// Only clear generated JS files inside this unpublished local build directory.
for(const name of await fs.readdir(out))if(name.endsWith('.mjs'))await fs.unlink(path.join(out,name));
await build({entryPoints:[path.join(root,'js/scenario/app.mjs')],nodePaths:[path.join(root,'build/scenario/node_modules')],outdir:out,bundle:true,splitting:true,format:'esm',minify:true,target:'es2022',entryNames:'app',chunkNames:'[name]-[hash]',outExtension:{'.js':'.mjs'},define:{SCENARIO_WORKER_URL:JSON.stringify('/dist/scenario/v0.1.0/worker.mjs')}});
await build({entryPoints:[path.join(root,'js/scenario/worker.mjs')],outfile:path.join(out,'worker.mjs'),bundle:true,format:'esm',minify:true,target:'es2022'});
await fs.cp(path.join(root,'data/scenario'),path.join(out,'data'),{recursive:true});
await fs.copyFile(path.join(root,'css/scenario-workbench.css'),path.join(out,'style.css'));
const threeLicense=await fs.readFile(path.join(root,'build/scenario/node_modules/three/LICENSE'),'utf8');
await fs.writeFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),`Three.js 0.181.2 https://github.com/mrdoob/three.js\n${threeLicense}\nBuild-time: esbuild 0.25.12 (MIT), Playwright 1.57.0 (Apache-2.0); not shipped as runtime.\n`);
const files=[];for(const f of await fs.readdir(out)){if(f.endsWith('.mjs')){const b=await fs.readFile(path.join(out,f));files.push({file:f,bytes:b.length,gzipBytes:gzipSync(b).length});}}
await fs.writeFile(path.join(out,'asset-sizes.json'),JSON.stringify(files,null,2));console.log(JSON.stringify(files));

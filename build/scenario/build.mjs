import {build} from 'esbuild';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {gzipSync} from 'node:zlib';
import {APP_VERSION} from '../../js/scenario/version.mjs';
import {createHash} from 'node:crypto';
import {makeNoiseVolume,NOISE_SIZE,NOISE_SEED,NOISE_VERSION} from '../../js/scenario/rendering/noise-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,`dist/scenario/v${APP_VERSION}`);
await fs.mkdir(out,{recursive:true});
// Only clear generated JS files inside this unpublished local build directory.
for(const name of await fs.readdir(out))if(name.endsWith('.mjs'))await fs.unlink(path.join(out,name));
await build({entryPoints:[path.join(root,'js/scenario/app.mjs')],nodePaths:[path.join(root,'build/scenario/node_modules')],outdir:out,bundle:true,splitting:true,format:'esm',minify:true,target:'es2022',entryNames:'app',chunkNames:'[name]-[hash]',outExtension:{'.js':'.mjs'},define:{SCENARIO_WORKER_URL:JSON.stringify(`/dist/scenario/v${APP_VERSION}/worker.mjs`)}});
await build({entryPoints:[path.join(root,'js/scenario/worker.mjs')],outfile:path.join(out,'worker.mjs'),bundle:true,format:'esm',minify:true,target:'es2022'});
await fs.cp(path.join(root,'data/scenario'),path.join(out,'data'),{recursive:true});
await fs.copyFile(path.join(root,'css/scenario-workbench.css'),path.join(out,'style.css'));
const threeLicense=await fs.readFile(path.join(root,'build/scenario/node_modules/three/LICENSE'),'utf8');
await fs.writeFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),`Three.js 0.181.2 https://github.com/mrdoob/three.js\n${threeLicense}\nBuild-time: esbuild 0.25.12 (MIT), Playwright 1.57.0 (Apache-2.0); not shipped as runtime.\n`);
const files=[];for(const f of await fs.readdir(out)){if(f.endsWith('.mjs')){const b=await fs.readFile(path.join(out,f));files.push({file:f,bytes:b.length,gzipBytes:gzipSync(b).length});}}
await fs.writeFile(path.join(out,'asset-sizes.json'),JSON.stringify(files,null,2));console.log(JSON.stringify(files));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const objects=[];
const mime={'.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
async function walk(dir,prefix='') { for(const item of await fs.readdir(dir,{withFileTypes:true})) {const rel=prefix+item.name;if(item.isDirectory())await walk(path.join(dir,item.name),rel+'/');else if(item.name!=='assets-manifest.json'){const bytes=await fs.readFile(path.join(dir,item.name));objects.push({path:rel,sha256:sha(bytes),sizeBytes:bytes.length,contentType:mime[path.extname(item.name)]||'application/octet-stream',purpose:rel.startsWith('data/')?'场景与定性来源配置':rel.endsWith('.mjs')?'浏览器程序与体积渲染':'样式、许可或构建记录',license:rel.endsWith('.mjs')?'EHS-SIL project code; bundled Three.js MIT, see THIRD_PARTY_NOTICES.txt':'Project configuration or attribution; no third-party artwork'});}} }
await walk(out);
const noise=makeNoiseVolume();
const assetManifest={version:APP_VERSION,rendering:'procedural volumetric visual model; not industrial CFD',thirdPartyArtwork:[],blenderBake:'not_run',externalTextures:false,objects,proceduralAssets:[{assetId:'procedural-noise-r8',version:NOISE_VERSION,creator:'EHS-SIL procedural code',source:'js/scenario/rendering/noise-data.mjs',sourceHash:sha(await fs.readFile(path.join(root,'js/scenario/rendering/noise-data.mjs'))),license:'Project-authored algorithm; no external artwork',axis:'texture XYZ; scene uses ENU -> Three.js Y-up',voxelResolution:[NOISE_SIZE,NOISE_SIZE,NOISE_SIZE],channels:['R8 scalar noise; not concentration or temperature'],frameCount:1,playbackDuration:null,seed:NOISE_SEED,decodedBytes:noise.byteLength,hash:sha(noise),bounds:'Per-scene process.domain; see presets and scene-spec',visualValidity:'Fixed teaching presets; advected procedural field, not a baked or validated flow solution',toolVersion:'JavaScript deterministic xorshift32; Three.js 0.181.2 Data3DTexture'}]};
for (const [assetId,source,detail] of [
  ['industrial-pbr-surfaces','js/scenario/materials/industrial-palette.mjs',{voxelResolution:null,textureResolution:[64,64],textureCount:4,channels:['RGBA8'],decodedBaseBytes:65536,mipmaps:'Three grain textures generate mipmaps; base bytes exclude mip overhead',generation:'Deterministic sin-hash phase 17.19; project-authored metal, concrete, normal and contact textures'}],
  ['liquid-release-surface','js/scenario/effects/liquid-release.mjs',{voxelResolution:null,textureResolution:[64,64],textureCount:1,channels:['RGBA8 normal'],decodedBaseBytes:16384,generation:'Procedural normal surface and deterministic gravity-path geometry; no flow solver'}],
  ['industrial-geometry','js/scenario/three/scene-components.mjs',{bounds:'Current ENU equipment/process spec',generation:'Procedural tank, pipe rack and cabinet geometry; no imported model'}],
  ['daylight-environment','js/scenario/rendering/volume-environment.mjs',{generation:'Authored gradient daylight scene -> Three.js PMREM; no external HDRI',estimatedResidentBytes:6291456,memoryBasis:'Observed 768x1024 HalfFloat RGBA target; transient generation buffers excluded'}],
]) assetManifest.proceduralAssets.push({assetId,version:APP_VERSION,creator:'EHS-SIL procedural code',source,sourceHash:sha(await fs.readFile(path.join(root,source))),license:'Project-authored procedural generation; Three.js MIT runtime',axis:'Scene ENU -> Three.js [x,z,-y]',frameCount:1,visualValidity:'Visual presets only, not validated material or engineering models',...detail});
await fs.writeFile(path.join(out,'assets-manifest.json'),JSON.stringify(assetManifest,null,2));

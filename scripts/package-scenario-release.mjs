import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { APP_VERSION, SCHEMA_VERSION, DATA_VERSION } from '../js/scenario/version.mjs';
import { makeNoiseVolume, NOISE_SIZE, NOISE_SEED, NOISE_VERSION } from '../js/scenario/rendering/noise-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `Missing value for ${name}`);
  return args[index + 1];
};
const git = (...arguments_) => execFileSync('git', arguments_, { cwd: root, encoding: 'utf8' }).trim();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const SHA_PATTERN = /^[a-f0-9]{40}$/;

// Rechecked by GitHub GET on 2026-11-17: this local archive-root tree is the
// actual production main tree, not the unpublished V0.1.0/V0.1.1 feature trees.
const PRODUCTION_COMMIT = '3be8660da8e96d855be8952c59ffe769c87c3fd8';
const PRODUCTION_TREE = 'c6ea0c8f549722d0b7a2edfe23c66d24aa1ec3b0';
const version = arg('--version', APP_VERSION);
assert.equal(version, APP_VERSION, 'Requested release version differs from the application');
assert.equal(git('status', '--porcelain'), '', 'Commit all reviewed changes before packaging a release');
const localCommit = git('rev-parse', 'HEAD');
const sourceTree = git('rev-parse', 'HEAD^{tree}');
const releaseCommit = arg('--source-commit', localCommit);
assert.match(releaseCommit, SHA_PATTERN);
if (releaseCommit !== localCommit) {
  const suppliedTree = arg('--source-tree');
  assert.ok(suppliedTree, 'A remote sourceCommit requires --source-tree from its verified API receipt');
  assert.match(suppliedTree, SHA_PATTERN);
  assert.equal(suppliedTree, sourceTree, 'Remote source tree does not match the reviewed local tree');
} else if (args.includes('--source-tree')) {
  assert.equal(arg('--source-tree'), sourceTree, 'Supplied source tree does not match local HEAD');
}
const baseline = arg('--baseline', git('rev-list', '--max-parents=0', 'HEAD'));
const baselineTree = git('rev-parse', `${baseline}^{tree}`);
assert.equal(arg('--upstream-base', PRODUCTION_COMMIT), PRODUCTION_COMMIT,
  'Production source baseline changed; refresh the production audit before packaging');
assert.equal(baselineTree, PRODUCTION_TREE,
  'Packaging baseline is not the verified production main tree');

const out = path.resolve(root, arg('--out', `release-candidate/scenario-${version}`));
try {
  assert.deepEqual(await fs.readdir(out), [], 'Release output already contains files; choose a fresh --out');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const runtime = `dist/scenario/v${version}`;
const oldResourceDirectories = ['dist/scenario/v0.1.0/', 'dist/scenario/v0.1.1/'];
assert.ok(!oldResourceDirectories.includes(`${runtime}/`), 'Never overwrite an existing immutable runtime');
const entry = 'tools/scenario-workbench.html';
const publicPath = (file) => !/(?:node_modules|test-results|release-candidate|sandbox|protected)/.test(file) && (
  /^(?:index\.html|sitemap\.xml|robots\.txt)$/.test(file) ||
  /^(?:tools|topics|articles|products|dashboard)\/[^/]+\.html$/.test(file) ||
  /^js\/[^/]+\.js$/.test(file) ||
  (/^css\/[^/]+\.css$/.test(file) && file !== 'css/scenario-workbench.css') ||
  /^data\/[^/]+\.json$/.test(file) || /^assets\//.test(file)
);
const changes = [...new Set(git('diff', '--name-only', baseline, 'HEAD').split('\n').filter(Boolean))];
const changed = changes.filter(publicPath);
const files = new Set([entry, ...changed]);
async function collectRuntime(directory) {
  for (const item of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = `${directory}/${item.name}`;
    assert.ok(!item.isSymbolicLink(), `Runtime resource must not be a symlink: ${file}`);
    if (item.isDirectory()) await collectRuntime(file);
    else {
      assert.ok(item.isFile(), `Unsupported runtime resource: ${file}`);
      files.add(file);
    }
  }
}
await collectRuntime(runtime);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const mimeFor = (file) => {
  const value = MIME[path.extname(file).toLowerCase()];
  assert.ok(value, `Unreviewed content type for public resource: ${file}`);
  return value;
};
const bytes = new Map();
async function readRegular(file) {
  const absolute = path.join(root, file);
  assert.ok((await fs.lstat(absolute)).isFile(), `Public dependency must be a regular file: ${file}`);
  const content = await fs.readFile(absolute);
  const blobSha = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
  assert.equal(blobSha, git('rev-parse', `${localCommit}:${file}`),
    `Source bytes no longer match the frozen release commit: ${file}`);
  return content;
}
for (const file of files) {
  assert.ok(!/(?:docs\/|tests\/|js\/scenario\/|data\/scenario\/)/.test(file.replace(runtime, '')));
  const content = await readRegular(file);
  assert.ok(content.length, `Empty public object: ${file}`);
  assert.ok(!/localhost:|127\.0\.0\.1:|\/Users\/gobyjohn|实施时确定的版本/.test(content.toString()),
    `Development path or placeholder in public object: ${file}`);
  mimeFor(file);
  bytes.set(file, content);
}

const requiredData = [
  'capabilities.json', 'chemicals.json', 'equipment.json', 'presets.json',
  'visual-profiles.json', 'scenarios.json', 'source-manifest.json', 'model-registry.json',
];
for (const name of requiredData) {
  const file = `${runtime}/data/${name}`;
  assert.ok(files.has(file), `Missing required data: ${file}`);
  assert.deepEqual(bytes.get(file), await readRegular(`data/scenario/${name}`),
    `Built data is stale or differs from reviewed source: ${name}`);
  if (name !== 'model-registry.json') {
    assert.equal(JSON.parse(bytes.get(file)).dataVersion, DATA_VERSION, `Mixed data version: ${name}`);
  }
}
for (const name of ['app.mjs', 'worker.mjs', 'style.css', 'THIRD_PARTY_NOTICES.txt', 'assets-manifest.json']) {
  assert.ok(files.has(`${runtime}/${name}`), `Missing required runtime file: ${name}`);
}
assert.deepEqual(bytes.get(`${runtime}/style.css`), await readRegular('css/scenario-workbench.css'),
  'Built stylesheet differs from the reviewed source');
const cap = JSON.parse(bytes.get(`${runtime}/data/capabilities.json`));
assert.equal(cap.screeningEnabled, false);
assert.equal(cap.releaseKind, 'teaching');
assert.equal(cap.appVersion, version);
assert.equal(cap.dataVersion, DATA_VERSION);
assert.deepEqual(cap.approvedChemicalIds, []);
assert.equal(cap.frequencyModel, false);
const models = JSON.parse(bytes.get(`${runtime}/data/model-registry.json`)).models;
for (const model of models) {
  assert.equal(model.allowedUse, 'teaching');
  assert.equal(model.technicalReview, null);
}

// The asset manifest is a build inventory, not evidence of physical validity.
// Every runtime object except the inventory itself must be accounted for once.
const assetsManifestPath = `${runtime}/assets-manifest.json`;
const assets = JSON.parse(bytes.get(assetsManifestPath));
assert.equal(assets.version, version, 'Mixed asset manifest version');
assert.equal(assets.blenderBake, 'not_run', 'Blender evidence requires a separate reviewed asset pipeline');
assert.equal(assets.externalTextures, false, 'Unreviewed external textures are not releaseable');
assert.deepEqual(assets.thirdPartyArtwork, [], 'Third-party artwork requires a reviewed license and export path');
assert.ok(Array.isArray(assets.objects), 'Asset object inventory is missing');
const assetPaths = new Set();
for (const object of assets.objects) {
  assert.equal(typeof object.path, 'string', 'Invalid asset path');
  assert.ok(object.path && !object.path.startsWith('/') && !object.path.split('/').some(p => p === '..' || p === '.'),
    `Invalid relative runtime asset path: ${object.path}`);
  assert.ok(!assetPaths.has(object.path), `Duplicate runtime asset: ${object.path}`);
  assetPaths.add(object.path);
  const file = `${runtime}/${object.path}`;
  assert.ok(files.has(file) && file !== assetsManifestPath, `Unpackaged runtime asset: ${object.path}`);
  const content = bytes.get(file);
  assert.equal(object.sha256, sha(content), `Asset hash differs from real bytes: ${object.path}`);
  assert.equal(object.sizeBytes, content.length, `Asset size differs from real bytes: ${object.path}`);
  assert.equal(object.contentType, mimeFor(file), `Asset MIME differs from release type: ${object.path}`);
  assert.ok(typeof object.purpose === 'string' && object.purpose.length, `Asset purpose missing: ${object.path}`);
  assert.ok(typeof object.license === 'string' && object.license.length, `Asset license missing: ${object.path}`);
}
const runtimeAssetPaths = [...files].filter(file => file.startsWith(`${runtime}/`) && file !== assetsManifestPath)
  .map(file => file.slice(runtime.length + 1));
assert.deepEqual([...assetPaths].sort(), runtimeAssetPaths.sort(), 'Asset inventory does not exactly match the runtime');
assert.ok(Array.isArray(assets.proceduralAssets), 'Procedural asset inventory is missing');
assert.deepEqual(assets.proceduralAssets.map(asset=>asset.assetId).sort(),
  ['procedural-noise-r8','industrial-pbr-surfaces','liquid-release-surface','industrial-geometry','daylight-environment'].sort(),
  'Procedural asset inventory must cover every authored visual component');
for (const asset of assets.proceduralAssets) {
  assert.equal(asset.sourceHash,sha(await readRegular(asset.source)),`Procedural source fingerprint differs: ${asset.assetId}`);
  assert.ok(asset.creator && asset.license && asset.visualValidity, `Procedural provenance is missing: ${asset.assetId}`);
}
const noiseAsset = assets.proceduralAssets.find(asset=>asset.assetId==='procedural-noise-r8');
assert.equal(noiseAsset.assetId, 'procedural-noise-r8');
assert.equal(noiseAsset.version, NOISE_VERSION);
assert.equal(NOISE_SIZE, 64, 'Review the decoded noise budget before changing its resolution');
assert.deepEqual(noiseAsset.voxelResolution, [64, 64, 64]);
assert.equal(noiseAsset.seed, NOISE_SEED);
assert.equal(noiseAsset.frameCount, 1);
assert.equal(noiseAsset.playbackDuration, null, 'Static procedural noise is not a baked animation');
assert.equal(noiseAsset.source, 'js/scenario/rendering/noise-data.mjs');
assert.equal(noiseAsset.sourceHash, sha(await readRegular(noiseAsset.source)), 'Noise source fingerprint differs');
const proceduralNoiseBytes = makeNoiseVolume();
assert.equal(proceduralNoiseBytes.byteLength, 262144, 'Decoded 64³ R8 noise must be exactly 262144 bytes');
assert.equal(noiseAsset.decodedBytes, proceduralNoiseBytes.byteLength, 'Noise decoded memory declaration differs');
assert.equal(noiseAsset.hash, sha(proceduralNoiseBytes), 'Declared noise hash differs from generated R8 bytes');
assert.ok(Array.isArray(noiseAsset.channels) && noiseAsset.channels.length === 1 && noiseAsset.channels[0].includes('R8'),
  'Noise channels must describe the single R8 artistic scalar');

const prerequisites = new Set([
  'css/style.css', 'css/design-system.css', 'css/tool-guidance.css',
  'js/site-shell.js', 'assets/ehs-sil-logo.png',
]);
const origin = 'https://ehs-sil.com';
async function requireReference(reference, from, { runtimeOnly = false } = {}) {
  if (!reference || reference.startsWith('#') || /^(?:data:|blob:|mailto:|tel:)/.test(reference)) return;
  const url = new URL(reference.replaceAll('&amp;', '&'), `${origin}/${from}`);
  if (url.origin !== origin) {
    assert.ok(!runtimeOnly, `Cross-origin runtime dependency: ${reference}`);
    return;
  }
  const target = decodeURIComponent(url.pathname).replace(/^\//, '');
  assert.ok(target && !target.endsWith('/'), `Dependency must use an explicit file path: ${reference}`);
  await readRegular(target);
  if (target.startsWith('dist/scenario/')) {
    assert.ok(target.startsWith(`${runtime}/`), `Mixed scenario runtime version: ${target}`);
    assert.ok(files.has(target), `Runtime dependency is missing from manifest: ${target}`);
  } else if (!files.has(target)) prerequisites.add(target);
  return target;
}

const html = bytes.get(entry).toString();
assert.ok(html.includes(`data-scenario-app-version="${APP_VERSION}"`));
assert.ok(html.includes(`../${runtime}/app.mjs`));
assert.ok(oldResourceDirectories.every(directory => !html.includes(`/${directory.split('/').at(-2)}/`)),
  'New tool HTML still references an older runtime');
for (const match of html.matchAll(/<(script|link|img|source)\b[^>]*>/gi)) {
  const tag = match[0];
  const name = match[1].toLowerCase();
  if (name === 'link' && !/\brel=["'](?:stylesheet|icon|preload|modulepreload)["']/i.test(tag)) continue;
  const reference = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
  await requireReference(reference, entry, { runtimeOnly: true });
}

for (const file of [...files].filter((name) => name.endsWith('.mjs'))) {
  const text = bytes.get(file).toString();
  for (const match of text.matchAll(/(?:from|import\()\s*["'](\.\/[^"']+\.mjs)["']/g)) {
    await requireReference(match[1], file, { runtimeOnly: true });
  }
}
const workerReferences = [...bytes.get(`${runtime}/app.mjs`).toString()
  .matchAll(/new\s+Worker\(\s*["']([^"']+)["']/g)];
assert.ok(workerReferences.length, 'No explicit same-origin Worker reference was found');
for (const match of workerReferences) {
  const target = await requireReference(match[1], `${runtime}/app.mjs`, { runtimeOnly: true });
  assert.equal(target, `${runtime}/worker.mjs`, 'Worker URL does not match the release version');
}

// Verify CSS URLs recursively, including existing shared stylesheets. Existing
// dependencies remain prerequisites and are checked, not silently republished.
const checkedCss = new Set();
async function checkCss(file) {
  if (checkedCss.has(file)) return;
  checkedCss.add(file);
  const text = (bytes.get(file) || await readRegular(file)).toString();
  for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
    const target = await requireReference(match[1], file, { runtimeOnly: true });
    if (target?.endsWith('.css')) await checkCss(target);
  }
}
for (const file of [...files, ...prerequisites].filter((name) => name.endsWith('.css'))) await checkCss(file);
const prerequisiteHashes = [];
for (const file of [...prerequisites].filter((name) => !files.has(name)).sort()) {
  const content = await readRegular(file);
  prerequisiteHashes.push({ path: file, sha256: sha(content), sizeBytes: content.length, contentType: mimeFor(file) });
}
const existsAtBaseline = (file) => Boolean(git('ls-tree', baseline, '--', file));
const rollbackBytes = await readRegular('docs/scenario/rollback-v020.md');

const manifest = {
  releaseId: `scenario-${version}`, sourceCommit: releaseCommit, sourceTree, localCommit,
  upstreamBase: PRODUCTION_COMMIT, upstreamTree: PRODUCTION_TREE,
  baselineLocalCommit: git('rev-parse', baseline), baselineTree,
  buildTime: new Date().toISOString(), appVersion: version, schemaVersion: SCHEMA_VERSION,
  dataVersion: DATA_VERSION, releaseKind: 'teaching', screeningEnabled: false,
  modelStates: models, files: [], overwriteObjects: changed.filter(existsAtBaseline),
  newToolObject: existsAtBaseline(entry) ? null : entry,
  oldResourceDirectories,
  assetsManifest: { path: assetsManifestPath, sha256: sha(bytes.get(assetsManifestPath)), objects: assets.objects.length },
  proceduralNoise: { assetId: noiseAsset.assetId, version: NOISE_VERSION, seed: NOISE_SEED,
    decodedBytes: proceduralNoiseBytes.byteLength, sha256: sha(proceduralNoiseBytes), sourceHash: noiseAsset.sourceHash },
  requiredChecks: ['data validation', 'full Node tests', 'secret scan', 'scenario browser checks',
    'five independent processes', '3D PNG', '360-degree and depth occlusion', 'asset inventory and noise hash'],
  prerequisites: prerequisiteHashes.map((item) => item.path), prerequisiteHashes,
  rollbackPlan: 'rollback.md',
};
for (const file of [...files].sort()) {
  assert.ok(!oldResourceDirectories.some(directory => file.startsWith(directory)), 'Old immutable runtime entered release files');
  const content = bytes.get(file);
  const destination = path.join(out, 'public', file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
  manifest.files.push({
    path: file, targetKey: file, sha256: sha(content), sizeBytes: content.length,
    contentType: mimeFor(file),
    cacheControl: file.startsWith(`${runtime}/`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    phase: file.startsWith(`${runtime}/`) ? 1 : file === entry ? 2 : file === 'sitemap.xml' ? 4 : 3,
  });
}
async function outputFiles(directory, prefix = '') {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    assert.ok(!item.isSymbolicLink(), 'A release directory must not contain symlinks');
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) result.push(...await outputFiles(path.join(directory, item.name), name));
    else result.push(name);
  }
  return result;
}
assert.deepEqual((await outputFiles(path.join(out, 'public'))).sort(), manifest.files.map((item) => item.path).sort(),
  'Release public directory contains objects outside the manifest');
for (const item of manifest.files) {
  assert.equal(sha(await fs.readFile(path.join(out, 'public', item.path))), item.sha256,
    `Packaged bytes differ from the manifest: ${item.path}`);
}
assert.equal(git('rev-parse', 'HEAD'), localCommit, 'HEAD changed while packaging the release');
assert.equal(git('status', '--porcelain'), '', 'Source tree changed while packaging the release');
await fs.writeFile(path.join(out, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join(out, 'rollback.md'), rollbackBytes);
await fs.writeFile(path.join(out, 'README.md'), `# Scenario ${version} 发布候选

教学版，screeningEnabled=false；源码 ${releaseCommit}，sourceTree ${sourceTree}。

本包 ${files.size} 个公开运行对象，按 manifest.phase 资源→工具HTML→实际变动入口→sitemap 发布，逐项核验 hash/MIME。
清单相对已核对的生产 main ${PRODUCTION_COMMIT} 文件树生成，不以未发布的 V0.1.0 或 V0.1.1 为生产基线。

只上传 public 中 manifest 指定文件；不整体同步仓库。QA、源码、docs、用户项目和凭据不在公开包。
共享前置依赖仅记录本地来源哈希，上传前还需核对其实际生产字节，不擅自覆盖。
旧 v0.1.0 与 v0.1.1 资源保持原样。上传前备份 overwriteObjects 的真实字节和元数据；当前工具404首页兜底不是旧工作台，详见 rollback.md。
assets-manifest逐一覆盖运行对象（清单自身除外），并校验真实hash/MIME/size；64³ R8程序噪声解码262144字节，其哈希已从确定性源码实际生成复核，不是网络资源或工程场。
`);
console.log(JSON.stringify({
  status: 'DRY_RUN', files: files.size,
  bytes: manifest.files.reduce((total, file) => total + file.sizeBytes, 0),
  sourceCommit: releaseCommit, sourceTree,
  manifest: path.relative(root, path.join(out, 'release-manifest.json')),
}));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
test('homepage preserves the supplied original identity without redrawing',()=>{
 const logo=fs.readFileSync(new URL('../assets/ehs-sil-logo-original.jpg',import.meta.url));
 assert.equal(crypto.createHash('sha256').update(logo).digest('hex'),'1a0347800f5b143b074f4b986970363a8765299adee6fe6be127c7efd2d11558');
 assert.equal((html.match(/<img[^>]+src="assets\/ehs-sil-logo-original.jpg"/g)||[]).length,2);
 assert.doesNotMatch(html,/brand-emblem/);
});
test('home sections follow brand, task, resources, trust and support order',()=>{
 const ids=['hero','value','workbench','content','about','membership','faq','follow'];
 const positions=ids.map(id=>html.indexOf(`id="${id}"`));
 assert.ok(positions.every((v,i)=>v>=0&&(i===0||v>positions[i-1])));
 const anchors=[...html.matchAll(/href="#([^"]+)"/g)].map(x=>x[1]);
 anchors.forEach(id=>assert.ok(html.includes(`id="${id}"`),id));
 assert.equal((html.match(/class="content-card"/g)||[]).length,3);
 assert.match(html,/<details class="reading-archive"/);
 assert.match(html,/tools\/index.html/);
 assert.match(html,/products\/training.html/);
});
test('social controls are honest and contain no invented profile URLs',()=>{
 assert.match(html,/https:\/\/mp.weixin.qq.com\/s\/ZbzkeYXNHtfcCyVSlRLHYA/);
 for(const platform of ['抖音','小红书','视频号']) assert.match(html,new RegExp(`data-copy-platform="${platform}"`));
 assert.match(html,/role="status" aria-live="polite"/);
 assert.doesNotMatch(html,/href="#"|javascript:|douyin.com\/user|xiaohongshu.com\/user/);
 assert.match(read('js/homepage-astra.js'),/未能自动复制/);
});

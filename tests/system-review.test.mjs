import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

function feedback(fetch) {
  const sandbox = {window: {}, document: {addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }},
    location: {pathname: '/feedback.html'}, setTimeout, clearTimeout, AbortController, fetch};
  vm.runInNewContext(read('js/feedback.js'), sandbox);
  return sandbox.window.EhsSilFeedback;
}

test('feedback rejects empty, malformed or unconfirmed 2xx receipts', async () => {
  for (const body of [{}, null, {ok:false}, {ok:true}, {ok:true,feedback_number:'undefined'}, {ok:true,feedback_number:'<script>'}]) {
    const api = feedback(async () => ({ok:true,status:200,json:async()=>body}));
    await assert.rejects(api.submit({}), /未返回有效接收编号/);
  }
  await assert.rejects(feedback(async()=>({ok:true,status:200,json:async()=>{throw Error('invalid JSON');}})).submit({}), /未返回有效接收编号/);
});

test('feedback only accepts backend receipt and preserves request id across retries', async () => {
  const sent = [];
  const receipt = {ok:true,feedback_number:'FB-20261006-TEST0001',duplicate:true};
  const api = feedback(async (url, options) => {sent.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>receipt};});
  const body = {request_id:'synthetic-review-request',description:'虚构测试问题，禁止用于生产提交'};
  assert.equal((await api.submit(body)).feedback_number,receipt.feedback_number);
  await api.submit(body);
  assert.equal(sent[0].request_id,sent[1].request_id);
});

test('feedback server, rate-limit and network failures never become success', async () => {
  for(const status of [400,409,429,500]) await assert.rejects(feedback(async()=>({ok:false,status,json:async()=>({message:'测试失败'})})).submit({}),/测试失败/);
  await assert.rejects(feedback(async()=>{throw Error('offline');}).submit({}),/无法连接/);
});

test('blocked storage cannot break analytics or page-local once semantics', () => {
  const blocked = {getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  const sandbox = {window:{dispatchEvent(){},console},sessionStorage:blocked,localStorage:blocked,CustomEvent:class{constructor(type,init){this.detail=init.detail;}},Date,Math,JSON};
  vm.runInNewContext(read('js/analytics.js'),sandbox);
  const api=sandbox.window.EhsSilAnalytics;
  assert.equal(api.trackOnce('tool_start',{toolId:'jsa-coach',description:'不得传输的事故正文'}),true);
  assert.equal(api.trackOnce('tool_start',{toolId:'jsa-coach'}),false);
  assert.doesNotMatch(JSON.stringify(sandbox.window._hmt),/事故正文/);
  assert.doesNotThrow(()=>api.setGroup('unknown'));
  // Quota exhaustion may allow reads but reject writes.
  sandbox.sessionStorage={getItem(){return null;},setItem(){throw Error('quota');}};
  assert.equal(api.trackOnce('tool_complete',{toolId:'jsa-coach'}),true);
  assert.equal(api.trackOnce('tool_complete',{toolId:'jsa-coach'}),false);
});

test('shared guidance has no auth, storage, analytics or external calls', () => {
  const script=read('js/tool-guidance.js');
  assert.doesNotMatch(script,/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|EhsSilAnalytics|EhsSilVip)\b/);
  assert.match(script,/feedback\.target = '_blank'/);
  for(const page of ['jsa-tool','compliance-identification','training-matrix','incident-learning','moc-coach']){
    const html=read('tools/'+page+'.html');
    assert.match(html,new RegExp('data-tool-guide="'+page+'\\.html"'));
    assert.match(html,new RegExp('canonical" href="https://ehs-sil.com/tools/'+page+'\\.html"'));
    assert.match(html,/property="og:description"/);
  }
  assert.doesNotMatch(read('tools/jsa-tool.html'),/RPN/);
  assert.match(read('tools/fmea-tool.html'),/FMEA/);
});

test('only verified legacy directory aliases redirect, without a loop or external destination', () => {
  for (const pathname of ['/tools/', '/tools', '/articles/', '/articles', '/', '/tools/index.html', '/unknown/']) {
    const targets=[];
    vm.runInNewContext(read('js/route-aliases.js'),{window:{location:{pathname,search:'?source=site',hash:'#example',replace:value=>targets.push(value)}}});
    if(['/tools/','/tools','/articles/','/articles'].includes(pathname))assert.deepEqual(targets,[pathname.replace(/\/$/,'')+'/index.html?source=site#example']);
    else assert.deepEqual(targets,[]);
  }
});

test('aborted membership request is an unconfirmed timeout, not expired', async () => {
  const storage={getItem(){return null;},setItem(){},removeItem(){}};
  const sandbox={window:{addEventListener(){},dispatchEvent(){},localStorage:storage},document:{addEventListener(){},hidden:false},
    localStorage:storage,location:{pathname:'/tools/compliance-identification.html',search:'',origin:'https://ehs-sil.com'},
    fetch:async()=>{const error=new Error('synthetic timeout');error.name='AbortError';throw error;},
    CustomEvent:class{constructor(type,init){this.detail=init.detail;}},URL,URLSearchParams,Date,Math,JSON,setTimeout,clearTimeout,AbortController,console};
  vm.runInNewContext(read('js/auth.js'),sandbox);
  const state=await sandbox.window.EhsSilVip.getSession();
  assert.equal(state.status,'error');assert.equal(state.error_code,'TIMEOUT');assert.equal(state.active,false);
  assert.match(state.message,/超时/);
});

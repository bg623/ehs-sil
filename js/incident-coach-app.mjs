import {MAX_BACKUP_BYTES,STEPS,DEFINITIONS,COLLECTIONS,TITLES,CATEGORIES,BOUNDARY,createCase,addRecord,removeRecord,recommend,checkCase,parseBackup,exampleCase,learningCard,exportSheets} from './incident-coach-model.mjs?v=20260921';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let state=createCase(),step=0,dirty=false;
const groups=['event','plan','evidence','timeline','barriers','causes','actions','learning'];
const hints=[
 '先记录发生了什么和潜在后果。不要填写姓名、健康信息、企业机密或粘贴真实附件；只用角色与记录代号。',
 '调查深度是资源安排，不是法定事故等级。让生产、设备、当事人代表和 EHS 共同参与，必要时请相关专业人员支持。',
 '记录证据摘要与来源代号，不上传原始材料。多个来源也可能来自同一个说法；确认状态及冲突须由调查组核实。',
 '按事发顺序添加节点；不确定时间可用“约”“前后”。时间先后不等于因果关系。',
 '从危险源与失去控制的事件出发，检查防止发生和减轻后果的屏障。有效屏障也值得保留，未知不等于缺失。',
 '先有事实与屏障，再追问“哪些条件使它发生”。可从七个维度整理多条原因链，不必凑满五问，也不要预设唯一根因。',
 '每项措施关联屏障或原因。针对假设先安排核实行动；控制层级只是选择顺序，不是有效性评分。',
 '先核对完成依据，再核对实际效果。学习卡片保留未知和冲突，不会自动识别人名、自动发布或批准关闭。'
];
function message(text){$('#coach-status').textContent=text;}
function changed(){dirty=true;$('#report-region').hidden=true;$('#save-state').textContent='内容仅在本页 · 离开前导出 JSON 备份';}
function choices(target){return target==='targets'?[...state.barriers,...state.causes]:state[target];}
function field(d,row,uid){const label=el('label',undefined,'ic-field');label.append(el('span',d.label));const id=`${uid}-${d.key}`;
 if(d.type==='refs'){
  const fieldset=el('fieldset',undefined,'ic-refs');fieldset.append(el('legend',d.label));const pool=choices(d.options).filter(x=>x.id!==row.id);const ids=new Set(pool.map(x=>x.id));
  if(!pool.length)fieldset.append(el('p','暂无可关联记录，请先到前面步骤添加。','ic-muted'));
  for(const item of pool){const wrap=el('label');const input=el('input');input.type='checkbox';input.checked=row[d.key].includes(item.id);input.addEventListener('change',()=>{row[d.key]=input.checked?[...row[d.key],item.id]:row[d.key].filter(x=>x!==item.id);changed();});wrap.append(input,el('span',`${item.id} · ${item.text.slice(0,65)||'待填写'}`));fieldset.append(wrap);}
  for(const missing of row[d.key].filter(x=>!ids.has(x))){const wrap=el('label');const input=el('input');input.type='checkbox';input.checked=true;input.addEventListener('change',()=>{row[d.key]=row[d.key].filter(x=>x!==missing);changed();wrap.remove();});wrap.append(input,el('span',`${missing} 已不存在或不能关联自身；取消勾选以解除。`));fieldset.append(wrap);}
  return fieldset;
 }
 const input=el(d.type==='area'?'textarea':d.type==='select'?'select':'input');input.id=id;input.name=id;
 if(d.type==='select')for(const opt of d.options){const option=el('option',opt);option.value=opt;input.append(option);}
 else {input.maxLength=2400;if(d.type==='area')input.rows=3;else input.type=d.type==='date'?'date':'text';input.autocomplete='off';}
 input.value=row[d.key];input.addEventListener('input',()=>{row[d.key]=input.value;changed();});label.htmlFor=id;label.append(input);return label;
}
function fields(group,row,uid){const grid=el('div',undefined,'ic-fields'),more=el('div',undefined,'ic-fields');for(const d of DEFINITIONS[group]){const n=field(d,row,uid);if(d.type==='area'||d.type==='refs')n.classList.add('wide');(group==='actions'&&['status','completion','effectiveness','verifier','verifiedAt'].includes(d.key)?more:grid).append(n);}if(more.childNodes.length){const detail=accordion('完成与效果验证（实施后填写）',more);detail.className='wide';grid.append(detail);}return grid;}
function accordion(title,body){const d=el('details');d.append(el('summary',title),body);return d;}
function render(){
 const nav=$('#step-nav');nav.replaceChildren();STEPS.forEach((name,i)=>{const b=el('button');b.type='button';b.append(el('span',String(i+1).padStart(2,'0')),el('strong',name));if(i===step)b.setAttribute('aria-current','step');b.addEventListener('click',()=>go(i));nav.append(b);});
 $('#step-number').textContent=`步骤 ${step+1} / 8`;
 $('#step-title').textContent=STEPS[step];$('#step-hint').textContent=hints[step];$('#prev-step').disabled=step===0;$('#next-step').textContent=step===7?'生成调查底稿':'下一步 →';
 const host=$('#step-content');host.replaceChildren();const g=groups[step];
 if(step===1){const r=recommend(state);const box=el('aside',undefined,'ic-coaching');box.append(el('strong',`建议：${r.depth}（人工决定）`),el('p',r.reason),el('p',r.method));host.append(box);}
 if(step===5&&(!state.timeline.length||!state.barriers.length))host.append(el('p','时间线或屏障尚未建立。可以先记录假设，但不要作出原因结论。','ic-warning'));
 if(COLLECTIONS.includes(g)){
  if(!state[g].length)host.append(el('div',`从一条${TITLES[g]}记录开始。编号由工具自动生成，后续步骤可直接关联。`,'ic-empty'));
  for(const r of state[g]){const card=el('article',undefined,'ic-record');const header=el('div',undefined,'ic-record-head');header.append(el('h3',`${r.id} · ${TITLES[g]}`));const remove=el('button','移除此条','ic-text-button');remove.type='button';remove.addEventListener('click',()=>{if(!confirm(`移除 ${r.id}？其他记录的关联会保留为待修复提示。`))return;removeRecord(state,g,r.id);changed();render();});header.append(remove);card.append(header,fields(g,r,r.id));host.append(card);}
  const add=el('button',`＋ 添加${TITLES[g]}记录`,'ic-button secondary');add.type='button';add.disabled=state[g].length>=40;add.addEventListener('click',()=>{const row=addRecord(state,g);changed();render();document.getElementById(`${row.id}-${DEFINITIONS[g][0].key}`)?.focus();});host.append(add);
 }else host.append(fields(g,state[g],g));
 if(step===1){const list=el('ul');['现场位置、边界与变动记录','设备、阀位、仪表、报警和联锁状态','隔离与残余能量、物料及环境条件','工具、PPE 个人防护装备与屏障状态','现场照片、样品和电子记录由企业按程序保管，本站不接收附件'].forEach(t=>list.append(el('li',t)));host.append(accordion('现场勘查提示',list));const q=el('ul');['当时你看到了什么、掌握了什么信息？','当时为什么认为这样做是合理的？','正常做法是什么？当天有什么不同？','任务、工具、压力、沟通与程序影响了哪些选择？','哪些屏障本应起作用？还需要核实什么？'].forEach(t=>q.append(el('li',t)));host.append(accordion('事实导向访谈问题',q));}
 if(step===5){const map=el('div',undefined,'ic-cause-map');for(const category of CATEGORIES){const box=el('div');box.append(el('h3',category));const rows=state.causes.filter(c=>c.category===category);box.append(el('p',rows.map(c=>`${c.id} ${c.text||'待填写'}〔${c.status}〕${c.parents.length?' → 解释 '+c.parents.join('、'):''}`).join('\n')||'尚无记录，不代表该维度无影响。'));map.append(box);}const fish=accordion('按鱼骨维度查看原因',map);fish.addEventListener('toggle',()=>{if(!fish.open)return;map.querySelectorAll('div').forEach((box,i)=>{const rows=state.causes.filter(c=>c.category===CATEGORIES[i]);box.querySelector('p').textContent=rows.map(c=>`${c.id} ${c.text||'待填写'}〔${c.status}〕${c.parents.length?' → 解释 '+c.parents.join('、'):''}`).join('\n')||'尚无记录，不代表该维度无影响。';});});host.append(fish);host.append(accordion('已有高级工具（分别打开，不自动传递本页数据）',advanced()));}
 if(step===7){host.append(issueList(checkCase(state)));const b=el('button','预览 LFI 学习卡片','ic-button secondary');b.type='button';b.addEventListener('click',()=>showReport(true));host.append(b);}
}
function advanced(){const div=el('div');for(const [url,name] of [['rca-tool.html','5Why 五问法与鱼骨图'],['apollo-rca-tool.html','Apollo RCA 原因分析（会员）'],['tripod-beta-tool.html','Tripod Beta 屏障分析（会员）']]){const a=el('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';div.append(a,el('br'));}div.append(el('p','保留原工具与权益。本页不提供官方认证或商业方法授权，复杂调查应由具备相应能力的人员主持。'));return div;}
function issueList(issues){const box=el('div',undefined,'ic-checks');box.append(el('h3','需要人工复核'));if(!issues.length)box.append(el('p','未发现已定义的字段缺口；这不证明事实正确、措施有效或可以关闭事件。'));else{const list=el('ul');for(const i of issues){const li=el('li');const b=el('button',`${STEPS[i.step]}：${i.text}`,'ic-text-button');b.type='button';b.addEventListener('click',()=>go(i.step));li.append(b);list.append(li);}box.append(list);}return box;}
function go(n){step=n;render();$('#step-title').focus();$('#workspace').scrollIntoView({behavior:'auto',block:'start'});}
function showReport(lfi=false){const host=$('#report-content');host.replaceChildren(el('h2',lfi?'LFI 学习卡片 · 待人工复核':'事故调查底稿 · 待人工复核'),el('p',BOUNDARY,'ic-warning'));host.append(issueList(checkCase(state)));const sheets=lfi?[{name:'LFI 学习卡片',rows:[['项目','内容'],...learningCard(state)]}]:exportSheets(state).filter(s=>s.name!=='待人工复核');for(const sheet of sheets){const block=el('section',undefined,'ic-report-block');block.append(el('h3',sheet.name));for(const row of sheet.rows.slice(1)){const d=el('dl');row.forEach((value,i)=>{d.append(el('dt',sheet.rows[0][i]),el('dd',String(value||'未填写')));});block.append(d);}if(sheet.rows.length===1)block.append(el('p','尚无记录。'));host.append(block);}$('#report-region').hidden=false;$('#report-title').focus();$('#report-region').scrollIntoView({behavior:'auto'});}
function download(blob,name){const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function confirmExport(){return confirm('导出文件可能包含你的填写内容。请核对个人与保密信息，并自行控制保管和分享范围。继续导出到本机？');}
$('#next-step').addEventListener('click',()=>step===7?showReport():go(step+1));$('#prev-step').addEventListener('click',()=>go(step-1));
$('#start-coach').addEventListener('click',()=>go(0));
$('#load-example').addEventListener('click',()=>{if(dirty&&!confirm('载入虚构案例会替换本页内容。请先导出备份。继续？'))return;state=exampleCase();changed();go(0);message('已载入虚构教学案例。单一来源和假设被保留，不代表真实调查结论。');});
$('#clear-case').addEventListener('click',()=>{if(!confirm('清空本页所有记录？已下载的文件不会删除。'))return;state=createCase();dirty=false;$('#report-region').hidden=true;$('#save-state').textContent='内容仅在本页 · 不自动保存';go(0);message('本页内容已清空。');});
$('#backup-case').addEventListener('click',()=>{if(!confirmExport())return;download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'EHS-SIL-调查备份.json');message('JSON 备份已生成；备份未加密，请妥善保管。');});
$('#restore-case').addEventListener('click',()=>$('#backup-file').click());
$('#backup-file').addEventListener('change',async e=>{const input=e.target,file=input.files[0];try{if(!file)return;if(file.size>MAX_BACKUP_BYTES)throw Error('文件超过 16 MB。');const next=parseBackup(await file.text());if(dirty&&!confirm('用备份替换当前记录？请先导出未保存内容。'))return;state=next;changed();go(0);message('已恢复到本页；内容未上传。请检查备份中的事实与关联。');}catch{message('无法恢复：请使用本工具导出的有效 JSON 备份（最大 16 MB），当前记录未改变。');}finally{input.value='';}});
$('#export-excel').addEventListener('click',async()=>{if(!confirmExport())return;const b=$('#export-excel');b.disabled=true;try{if(!window.ExcelJS)throw Error('Excel library unavailable');const wb=new window.ExcelJS.Workbook();wb.creator='EHS-SIL';for(const sheet of exportSheets(state)){const ws=wb.addWorksheet(sheet.name);ws.addRows(sheet.rows);ws.columns=sheet.rows[0].map((_,i)=>({width:sheet.rows[0].length===2?(i===0?30:100):i===0?12:34}));ws.views=[{state:'frozen',ySplit:1}];ws.eachRow((row,r)=>{row.height=r===1?36:Math.min(409,Math.max(36,...row.values.slice(1).map((value,i)=>{const width=ws.columns[i].width||34;const lines=String(value||'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].reduce((n,c)=>n+(c.charCodeAt(0)>255?2:1),0)/(width-3))),0);return lines*17+14;})));row.eachCell({includeEmpty:true},cell=>{cell.font={name:'Arial',size:11,color:{argb:r===1?'FFFFFFFF':'FF173E45'},bold:r===1};cell.alignment={vertical:'top',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r===1?'FF174D50':r%2?'FFF0F4EC':'FFFFFFFF'}};});});ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};}download(new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'EHS-SIL-事故调查底稿.xlsx');message('Excel 已生成。长文本请在表格软件中调整行高；所有记录均为待人工复核底稿。');}catch{message('Excel 导出失败，请重试或先保存 JSON 备份。');}finally{b.disabled=false;}});
$('#preview-case').addEventListener('click',()=>showReport());$('#print-case').addEventListener('click',()=>{if(confirmExport())window.print();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
render();

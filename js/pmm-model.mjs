// PMM prompts support human review; they never classify a person or decide a sanction.
export const VERSION = 'PMM-2026.09-v1';
export const BOUNDARY = '对话记录草稿，须由参与者与授权负责人复核。不构成行为定性、纪律处分、作业批准或法规符合性结论。';
export const hypotheses = [
  {id:'slip', name:'执行失误或遗忘（Slips / Lapses）', question:'原本准备怎么做？在哪一步操作偏差或漏做？', action:'核对界面、标识、干扰与任务负荷；考虑防错设计、关键步骤提示和独立复核。不能仅靠再培训防止此类失误。'},
  {id:'mistake', name:'判断或知识偏差（Mistakes）', question:'当时掌握哪些信息？为什么认为这样做是对的？', action:'核对信息可获得性、程序准确性和能力支持；针对实际缺口安排情景训练、决策辅助与带教。'},
  {id:'situational', name:'情境或例外下的偏离（Situational / Exceptional violations）', question:'按程序执行有什么障碍？是否存在可行的安全替代方式？', action:'共同排查资源、时间、工具与规则可执行性；消除障碍并明确遇到异常时停止、求助和升级的路径。'},
  {id:'routine', name:'习惯性偏离（Routine violations）', question:'类似做法是否普遍？管理者如何示范、反馈或默许？', action:'核对日常工作与书面程序的差距；管理层参与修订可执行规则，改善监督和冲突目标，持续验证。'},
  {id:'unknown', name:'信息不足或多种解释并存（Uncertain / Mixed）', question:'哪些是事实，哪些只是推测？还需要听谁的意见或核实什么？', action:'保留不确定性，补充不同视角和客观证据；不得因结果严重或存在利益动机直接作出行为定性。'}
];
export const factors = [
  ['task','任务与界面（Task / Interface）','步骤、标识、可用工具、任务复杂度'],
  ['conditions','工作条件（Working conditions）','照明、噪声、干扰、设备可达性'],
  ['capacity','能力与状态（Capability / Readiness）','信息、熟练程度、疲劳、工作负荷；不记录健康隐私'],
  ['organization','组织与管理（Organization）','排班、进度压力、监督、激励、管理者示范'],
  ['team','协作与沟通（Team / Communication）','交接、承包商接口、同伴做法、求助渠道']
];
export function clean(value, max=1800) {return String(value ?? '').replace(/\u0000/g,'').trim().slice(0,max);}
export function excelText(value) {const s=clean(value,10000); return /^[=+@-]/.test(s) ? "'"+s : s;}
export function buildReport(input) {
  const positive=input.mode==='recognition';
  const ids=new Set(Array.isArray(input.hypotheses)?input.hypotheses:[]);
  const selected=positive?[]:hypotheses.filter(h=>ids.has(h.id));
  const chosenFactors=factors.filter(f=>(input.factors||[]).includes(f[0]));
  const actions=(input.actions||[]).slice(0,12).map(a=>({kind:['组织改进','个人支持','正向认可'].includes(a.kind)?a.kind:'组织改进', action:clean(a.action),owner:clean(a.owner,120),due:clean(a.due,20),evidence:clean(a.evidence),status:['待实施','实施中','待验证','已验证'].includes(a.status)?a.status:'待实施'})).filter(a=>a.action);
  const missing=[];
  for(const [key,label] of [['event','可观察的行为事实'],['view','当事人视角'],['context','工作情境与组织支持'],['review','复核与跟进安排']]) if(!clean(input[key])) missing.push(label);
  if(!positive&&!selected.length) missing.push('待核实的解释（可选“信息不足”）');
  if(positive&&!clean(input.impact)) missing.push('行为的具体价值与可复制条件');
  if(!actions.length) missing.push('至少一项行动及验证安排');
  if(!positive&&!actions.some(a=>a.kind==='组织改进')) missing.push('组织改进或确认无需改进的依据');
  if(actions.some(a=>!a.owner||!a.due||!a.evidence)) missing.push('行动的负责人代号、目标日期和验证依据');
  if(actions.some(a=>a.status==='已验证')) missing.push('标记为“已验证”的行动仍需授权人员核实；本工具不验证证据真伪');
  return {version:VERSION,boundary:BOUNDARY,mode:positive?'正向认可':'改进对话',date:clean(input.date,20),alias:clean(input.alias,120),event:clean(input.event),view:clean(input.view),context:clean(input.context),evidence:clean(input.evidence),impact:positive?clean(input.impact):'',review:clean(input.review),hypotheses:selected.map(h=>({...h})),factors:chosenFactors.map(f=>f[1]),actions,missing};
}
export const examples = {
  improvement:{mode:'improvement',event:'【虚构教学示例】操作人员在交接后漏做一项设备状态复核，被同事及时提醒。现场已停止该操作并按程序确认状态。',view:'当事人说：当时以为上一班已完成复核，交接中又被另一项任务打断。此说法尚待与交接记录核对。',context:'拟核实交接表是否清晰、任务切换频率及班组负责人如何分配并行任务。不能先归因为“不认真”。',evidence:'待核实：交接表、现场步骤、双方叙述。此案例及其证据均为教学虚构。',hypotheses:['slip','unknown'],factors:['task','organization','team'],review:'由班组负责人代号 M 与参与者核对事实；一周后观察新的交接方式是否实际有效。',actions:[{kind:'组织改进',action:'与使用者共同明确交接表的复核责任，并现场试用。',owner:'负责人 M',due:'',evidence:'观察两次交接并记录可执行性；征求使用者反馈。',status:'待实施'},{kind:'个人支持',action:'确认新流程理解一致，并在首次使用时提供同伴支持。',owner:'支持者 S',due:'',evidence:'现场演示与反馈记录。',status:'待实施'}]},
  recognition:{mode:'recognition',event:'【虚构教学示例】作业人员发现交接信息与现场不一致，主动暂停并请团队共同核实。',view:'当事人说：停止工作渠道清楚，主管此前明确支持不确定时求助。',context:'团队提供了可联系的专业支持，并为核实预留时间。',impact:'及时暴露信息差；拟复制清晰的求助渠道与主管支持方式，不奖励“零报告”。',review:'征得当事人同意后，由主管匿名分享学习点；后续询问求助渠道是否仍然畅通。',hypotheses:[],factors:['organization','team'],actions:[{kind:'正向认可',action:'经当事人同意，具体肯定主动暂停和求助的行为。',owner:'主管 M',due:'',evidence:'确认当事人接受的认可方式；不强制公开身份。',status:'待实施'}]}
};

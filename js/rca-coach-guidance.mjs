// Original investigation prompts, informed by the linked public methodology.
// They are questions, not findings, legal determinations or certified assessments.
export const SOURCES = [
  ['ASQ 美国质量学会：5Why 五问法', 'https://asq.org/quality-resources/five-whys'],
  ['ASQ 美国质量学会：鱼骨图', 'https://asq.org/quality-resources/fishbone'],
  ['OSHA 美国职业安全健康管理局：事件调查', 'https://www.osha.gov/incident-investigation'],
  ['IHI 医疗改进研究所：RCA² 根因分析与行动', 'https://www.ihi.org/library/tools/rca2-improving-root-cause-analyses-and-actions-prevent-harm'],
  ['NIOSH 美国国家职业安全卫生研究所：控制层级', 'https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html']
];
export const CATEGORIES = [
  {id:'people',label:'人员与能力',en:'People',words:['培训','技能','疲劳','人员','交接','沟通'],question:'当事人当时掌握了什么信息？任务负荷、能力和协作条件是否匹配？',action:'评估任务负荷、可用信息与能力支持，检验工作条件改善是否有效。'},
  {id:'equipment',label:'设备与设计',en:'Equipment',words:['设备','防护罩','阀','联锁','泵','设计','维护','机械'],question:'设备设计、防护、隔离和维护状态是否与预期一致？有何记录可核对？',action:'评估设计、防护或隔离的工程改进，制定适用性及功能验证。'},
  {id:'material',label:'物料与介质',en:'Materials',words:['物料','介质','化学品','残液','腐蚀','原料'],question:'物料身份、状态、相容性或残余介质是否与作业假设一致？',action:'评估物料替代、封闭处理或状态识别的改进，并验证适用性。'},
  {id:'method',label:'方法与程序',en:'Methods',words:['程序','步骤','流程','作业票','规程','sop','方法'],question:'书面方法与实际工作是否一致？执行时有哪些限制或差异？',action:'评估流程简化、防错和作业条件改进，用实际任务验证可执行性。'},
  {id:'measurement',label:'测量与反馈',en:'Measurement',words:['报警','测量','仪表','校准','检测','传感','指示'],question:'测量、报警或反馈能否及时反映实际状态？数据质量和响应是否已核实？',action:'评估检测、报警和反馈的设计改进，通过测试核对可靠性与响应。'},
  {id:'environment',label:'环境与现场',en:'Environment',words:['照明','通道','地面','噪声','天气','空间','湿滑','积水'],question:'现场布局、空间、照明或环境条件如何影响了工作？与正常情况有何差异？',action:'评估布局、物理隔离或环境条件改进，现场验证接触机会是否改变。'},
  {id:'organization',label:'管理与组织',en:'Organization',words:['管理','资源','工期','采购','承包商','监督','变更','绩效'],question:'资源、变更、计划和跨部门决策如何影响现场条件？此前的类似问题是否得到处理？',action:'评估资源、变更和跨部门责任机制的改进，跟踪执行及实际效果。'},
  {id:'other',label:'待分类 / 其他',en:'To classify',words:[],question:'还有哪些不同的解释？什么观察或测试可以区分这些解释？',action:'先明确原因及证据，再选择对应的风险控制并制定验证方法。'}
];
export const SCENARIOS = [
 {id:'isolation',label:'能量隔离',match:/检修|拆卸|残压|泄压|能量|loto|隔离/i,prompts:[['equipment','实际隔离点及零能量确认方式是否有效？'],['method','停机、隔离、释放和确认的实际顺序是什么？'],['organization','设备或作业条件变更后，隔离方案是否重新核对？']]},
 {id:'leak',label:'泄漏与介质',match:/泄漏|飞溅|软管|化学|溢出|残液|leak/i,prompts:[['material','实际介质、温度与残余物料是否已核实？'],['equipment','连接、密封和围堵的状态与设计要求是否一致？'],['measurement','泄漏被何种信号发现，发现前有哪些可观察变化？']]},
 {id:'movement',label:'移动与人员站位',match:/叉车|吊装|搬运|坠落|滑倒|绊倒|碰撞|高处/i,prompts:[['environment','人员路线、危险运动路径和隔离边界是否交叉？'],['equipment','物理隔离、防坠或负载约束的实际状态如何？'],['method','当时的协作、指挥和站位与约定有什么差异？']]},
 {id:'machine',label:'设备与防护',match:/夹伤|机械|防护罩|联锁|旁路|意外启动|挤压/i,prompts:[['equipment','防护装置与危险运动之间的保护关系是否经过测试？'],['measurement','设备是否存在异常、报警或保护失效记录？'],['organization','防护变更、旁路或维护的管理条件是否已核实？']]}
];
export function categorize(text){const t=text.toLowerCase();const scored=CATEGORIES.filter(c=>c.words.length).map(c=>({id:c.id,n:c.words.filter(w=>t.includes(w)).length})).sort((a,b)=>b.n-a.n);return !scored[0].n||scored[0].n===scored[1].n?'other':scored[0].id;}
export function guidance(problem){const text=problem.title+' '+problem.description;const matched=SCENARIOS.filter(s=>s.match.test(text));const suggestions=matched.flatMap(s=>s.prompts.map(([category,text],i)=>({id:s.id+'-'+i,category,text,context:s.label})));for(const c of CATEGORIES.filter(c=>c.id!=='other'))if(!suggestions.some(p=>p.category===c.id))suggestions.push({id:'general-'+c.id,category:c.id,text:c.question,context:'通用调查方向'});return {scenarios:matched.map(s=>s.label),suggestions};}
export function questionFor(cause){const generic='是什么条件使这件事发生？有哪些证据、反证或其他解释？';if(/粗心|疏忽|不小心|违规|意识差|责任心|不负责|人为失误|不遵守/.test(cause.text))return '不要停在个人标签：当时为何这样做看起来合理？设计、工作条件、信息和组织支持有哪些影响？';return (CATEGORIES.find(c=>c.id===cause.category)?.question||generic)+' '+generic;}

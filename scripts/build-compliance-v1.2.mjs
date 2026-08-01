import fs from "node:fs";

const root=new URL("../",import.meta.url),legacyPath=new URL("data/regulations.json",root);
const legacy=JSON.parse(fs.readFileSync(legacyPath,"utf8"));
const dropIds=new Set(["REG-072","REG-074","REG-103","REG-164","REG-079","REG-154","REG-165","REG-160"]);
const corrections={
  "REG-022":{name:"工作场所有害因素职业接触限值 第1部分：化学有害因素",cn:"工作场所有害因素职业接触限值 第1部分：化学有害因素"},
  "REG-104":{name:"易燃易爆性商品储存养护技术条件",cn:"易燃易爆性商品储存养护技术条件"},
  "REG-051":{name:"职业健康监护技术规范",cn:"职业健康监护技术规范",status:"已废止",complianceEnabled:false,replacedBy:["GBZ 188-2025"],expiryDate:"2026-08-01"},
  "REG-018":{status:"已废止",complianceEnabled:false,replacedBy:["GB 6441-2025"],expiryDate:"2026-07-01"},
  "REG-020":{status:"已废止",complianceEnabled:false,replacedBy:["GB 2894-2025"],expiryDate:"2026-03-01"},
  "REG-023":{status:"已废止",complianceEnabled:false,replacedBy:["GB 2894-2025"],expiryDate:"2026-03-01"}
};
const previouslyVerifiedIds=new Set(["REG-NEW-001","REG-NEW-002","REG-NEW-003","REG-NEW-004","REG-NEW-005","REG-SD-001"]);
const directOfficial=/^https:\/\/(flk\.npc\.gov\.cn\/detail|openstd\.samr\.gov\.cn\/bzgk\/(?:std|gb)\/newGbInfo|std\.samr\.gov\.cn\/gb\/search\/gbDetailed|www\.mem\.gov\.cn\/.+\/t\d+_|www\.sd\.gov\.cn\/jpaas-jpolicy|www\.nhc\.gov\.cn\/(?:wjw\/pyl|fzs\/c100048)\/)/;
const normalize=s=>String(s||"").toUpperCase().replace(/[—–]/g,"-").replace(/\s+/g,"").replace(/－/g,"-");
const newCandidates=[{id:"REG-NEW-006",name:"职业健康监护技术规范",cn:"职业健康监护技术规范",documentNo:"GBZ 188-2025",num:"GBZ 188-2025",type:"国家职业卫生标准",category:"职业健康",levelRank:4,issuingAuthority:"国家卫生健康委员会",publishDate:"2025-08-20",effectiveDate:"2026-08-01",status:"现行有效",sourceUrl:"https://www.nhc.gov.cn/wjw/pyl/202509/1e939d64e61a4ac6b9d31191c5569c34.shtml",sourceName:"国家卫生健康委员会标准详情",sourceType:"国家卫生健康委员会",regions:["全国"],industries:["全部行业"],riskTags:["存在职业病危害"],enterpriseTypes:[],activityTags:[],applicabilityType:"条件触发",requirementSummary:"规定职业健康监护的基本原则、职业健康检查和监护档案等技术要求。具体适用内容需由专业人员结合职业病危害因素确认。",applicableClauses:"需人工确认",suggestedDepartment:["EHS部门","人力资源部门"],reviewFrequencyMonths:12,changeType:"替代",replaces:["GBZ 188-2014"],verificationStatus:"待复核",complianceEnabled:true,lastVerifiedAt:"2026-08-01",candidateReason:"官方元数据已定位，待产品负责人审核适用规则"}];
const unique=[];const standardKeys=new Set();
for(const raw of [...legacy.regulations,...newCandidates]){if(dropIds.has(raw.id))continue;const r={...raw,...(corrections[raw.id]||{})};const key=normalize(r.documentNo||r.num);const isStandard=/^(GB|GBZ|AQ|TSG|ISO|IEC|NFPA)/.test(key);if(isStandard&&standardKeys.has(key))continue;if(isStandard)standardKeys.add(key);r.canonicalKey=isStandard?key:`${key}::${normalize(r.name||r.cn)}`;if(previouslyVerifiedIds.has(r.id))r.verificationStatus="已核验";r.sourcePrecision=directOfficial.test(r.sourceUrl||r.link||"")?"direct_detail":"search_or_index";if(r.verificationStatus==="已核验"){r.reviewer=r.reviewer||"Codex（官方元数据核验）";if(r.sourcePrecision!=="direct_detail")r.verificationStatus="待复核";}unique.push(r);}

function makeRule(r){
  const no=normalize(r.documentNo||r.num),name=r.name||r.cn,all=[],any=[],exclude=[],review=[];let applicability="mandatory";
  if(r.applicabilityType==="通用基础")all.push("生产经营单位");
  any.push(...(r.enterpriseTypes||[]),...(r.industries||[]),...(r.riskTags||[]),...(r.activityTags||[]));
  if(any.includes("全部行业")){any.splice(any.indexOf("全部行业"),1);all.push("生产经营单位");}
  if(/重大危险源/.test(name)||no==="GB18218-2018"){all.splice(0);any.splice(0);all.push("构成危险化学品重大危险源");review.push("使用或储存危险化学品");}
  if(/填埋/.test(name)||no==="GB18598-2019"){all.splice(0);any.splice(0);all.push("危废填埋");}
  else if(/危险废物贮存/.test(name)||no==="GB18597-2023"){all.splice(0);any.splice(0);any.push("危废暂存","危废处置");review.push("危废产生");}
  const equipment=[[/(锅炉)/,"锅炉"],[/(压力容器|TSG21)/,"压力容器"],[/(压力管道)/,"压力管道"],[/(气瓶|TSG23)/,"气瓶"],[/(电梯)/,"电梯"],[/(起重机械|GB6067)/,"起重机械"],[/(场\(厂\)|场车|TSG81)/,"场（厂）内专用机动车辆"]];
  for(const [re,fact] of equipment)if(re.test(name+no)){all.splice(0);any.splice(0);all.push(fact);break;}
  if(/特种设备安全法/.test(name)){all.splice(0);any.splice(0);any.push("锅炉","压力容器","压力管道","气瓶","电梯","起重机械","场（厂）内专用机动车辆");}
  if(/45001/.test(name+no)){all.splice(0);any.splice(0);all.push("自愿采纳ISO 45001");applicability="voluntary";}
  if(/24001|14001/.test(name+no)){all.splice(0);any.splice(0);all.push("自愿采纳ISO 14001");applicability="voluntary";}
  if(/石油化工/.test(name)){all.push("石油化工属性");}
  if(/危险化学品.*(?:生产|标准化)|化工企业/.test(name)&&!all.includes("构成危险化学品重大危险源")){any.push("危化品生产","危化品储存");}
  return {ruleId:`RULE-${r.id}`,regulationId:r.id,includeAll:[...new Set(all)],includeAny:[...new Set(any)],excludeAny:exclude,reviewWhen:[...new Set(review)],applicability,explanationTemplate:applicability==="voluntary"?"企业已明确自愿采纳该管理体系标准":"企业画像满足该法规的受控触发条件",version:"1.2.0",status:"active"};
}
const formal=unique.filter(r=>r.complianceEnabled&&r.verificationStatus==="已核验"&&r.sourcePrecision==="direct_detail");
const candidates=unique.filter(r=>r.complianceEnabled&&!formal.some(x=>x.id===r.id)).map(r=>({...r,verificationStatus:"待复核",candidateReason:r.sourcePrecision!=="direct_detail"?"官方来源尚非直接详情页":"缺少完整元数据或人工复核"}));
const rules=[...formal,...candidates].map(makeRule);
const outDir=new URL("data/compliance/",root);fs.mkdirSync(outDir,{recursive:true});
const write=(name,value)=>fs.writeFileSync(new URL(name,outDir),JSON.stringify(value,null,2)+"\n");
write("laws.v1.json",{schemaVersion:"1.2.0",updatedAt:"2026-08-01",latestVerifiedAt:formal.map(r=>r.lastVerifiedAt).filter(Boolean).sort().at(-1)||"",records:formal});
write("candidates.v1.json",{schemaVersion:"1.2.0",updatedAt:"2026-08-01",publicationPolicy:"human_review_required",records:candidates});
write("rules.v1.json",{schemaVersion:"1.2.0",updatedAt:"2026-08-01",rules});
write("changes.v1.json",JSON.parse(fs.readFileSync(new URL("data/regulation-updates.json",root),"utf8")));
write("changelog.json",{schemaVersion:"1.0",entries:[{date:"2026-08-01",version:"1.2.0",summary:"拆分受控法规、候选法规和可解释匹配规则；清理重复与错误标准记录。",removedIds:[...dropIds],correctedIds:Object.keys(corrections)}]});
legacy.regulations=unique;legacy.schemaVersion="1.2";legacy.updatedAt="2026-08-01";fs.writeFileSync(legacyPath,JSON.stringify(legacy,null,2)+"\n");
console.log(JSON.stringify({legacy:unique.length,formal:formal.length,candidates:candidates.length,rules:rules.length,removed:[...dropIds],corrected:Object.keys(corrections)}));

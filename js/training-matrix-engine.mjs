export const LEVEL_RANK={recommended:1,conditional:2,mandatory:3};
export function escapeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function cleanCustomRole(value){return String(value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,30);}
export function matchRule(rule,profile){
  if(rule.industries.length&&!rule.industries.includes(profile.industry))return false;
  if(rule.risk_tags_all.length&&!rule.risk_tags_all.every(x=>profile.risks.includes(x)))return false;
  if(rule.risk_tags_any.length&&!rule.risk_tags_any.some(x=>profile.risks.includes(x)))return false;
  return true;
}
export function generateMatrix(profile,data){
  const roleMap=new Map(data.roles.map(x=>[x.id,x]));
  const topicMap=new Map(data.topics.map(x=>[x.topic_id,x]));
  const sourceMap=new Map(data.sources.map(x=>[x.source_id,x]));
  const roleIds=[...new Set(profile.roles)].filter(x=>roleMap.has(x));
  const out=new Map();
  for(const rule of data.rules){
    if(!matchRule(rule,profile))continue;
    const targets=rule.roles_any.length?roleIds.filter(id=>rule.roles_any.includes(id)):roleIds;
    for(const roleId of targets){
      const key=roleId+'|'+rule.topic_id, existing=out.get(key);
      if(!existing){out.set(key,{role_id:roleId,role_name:roleMap.get(roleId).name,topic_id:rule.topic_id,topic:topicMap.get(rule.topic_id),requirement_level:rule.requirement_level,priority:rule.priority,reasons:[rule.reason],rule_ids:[rule.rule_id],source_ids:[...rule.source_ids],training_triggers:[rule.training_trigger],internal_review_required:rule.internal_review_required});continue;}
      if(LEVEL_RANK[rule.requirement_level]>LEVEL_RANK[existing.requirement_level])existing.requirement_level=rule.requirement_level;
      if(['high','medium','low'].indexOf(rule.priority)<['high','medium','low'].indexOf(existing.priority))existing.priority=rule.priority;
      existing.reasons=[...new Set([...existing.reasons,rule.reason])]; existing.rule_ids.push(rule.rule_id);
      existing.source_ids=[...new Set([...existing.source_ids,...rule.source_ids])]; existing.training_triggers=[...new Set([...existing.training_triggers,rule.training_trigger])];
    }
  }
  const requirements=[...out.values()].map(x=>({...x,sources:x.source_ids.map(id=>sourceMap.get(id)).filter(Boolean)})).sort((a,b)=>a.role_name.localeCompare(b.role_name,'zh-CN')||a.topic.title_zh.localeCompare(b.topic.title_zh,'zh-CN'));
  const custom=cleanCustomRole(profile.customRole);
  if(custom){roleIds.push('custom');const topic=topicMap.get('job_sop');requirements.push({role_id:'custom',role_name:custom,topic_id:'job_sop',topic,requirement_level:'recommended',priority:'medium',reasons:['自定义岗位需要结合实际职责、风险和操作规程建立培训要求。'],rule_ids:['CUSTOM-REVIEW'],source_ids:['risk_review'],sources:[sourceMap.get('risk_review')],training_triggers:['上岗前及岗位、风险或规程变化时'],internal_review_required:true});}
  return {profile:{...profile,roles:roleIds,customRole:custom},requirements,roles:[...roleIds.map(id=>id==='custom'?{id,name:custom}:roleMap.get(id)).filter(Boolean)],topics:[...new Map(requirements.map(x=>[x.topic_id,x.topic])).values()],generated_at:new Date().toISOString(),version:'0.1.0'};
}
export function statusCode(level){return ({mandatory:'M',conditional:'C',recommended:'R'})[level]||'N/A';}
export function buildPlan(result){
  const month={high:'第1季度',medium:'第2—3季度',low:'第4季度'};
  return result.requirements.map((r,i)=>({window:/前|变更|作业|承担|接触|授权|入场/.test(r.training_triggers.join(''))?'事件/变更触发':month[r.priority],topic:r.topic.title_zh,role:r.role_name,trigger:r.training_triggers.join('；'),method:r.topic.delivery_methods.join('、'),owner:r.role_id==='principal'?'董事会/上级管理者':'岗位主管/EHS',assessment:r.topic.assessment_methods.join('、'),status:'待计划',note:'需企业内部复核',order:i+1}));
}

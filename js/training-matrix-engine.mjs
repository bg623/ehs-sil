export const LEVEL_RANK={recommended:1,conditional:2,mandatory:3};
const PRIORITY_RANK={high:1,medium:2,low:3};
const list=value=>Array.isArray(value)?value:[];
const unique=value=>[...new Set(value.filter(Boolean))];

export function escapeText(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function cleanCustomRole(value){return String(value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,30);}

export function matchRule(rule,profile){
  const industries=list(rule.industries),risks=list(profile.risks);
  const riskAny=list(rule.risk_tags_any),riskAll=list(rule.risk_tags_all),riskNone=list(rule.risk_tags_none);
  if(industries.length&&!industries.includes(profile.industry))return false;
  if(riskAll.length&&!riskAll.every(id=>risks.includes(id)))return false;
  if(riskAny.length&&!riskAny.some(id=>risks.includes(id)))return false;
  if(riskNone.length&&riskNone.some(id=>risks.includes(id)))return false;
  return true;
}

function requirementFromRule(rule,role,topic){
  return {
    role_id:role.id,role_name:role.name,topic_id:rule.topic_id,topic,
    requirement_level:rule.requirement_level,priority:rule.priority,
    reasons:[rule.reason],rule_ids:[rule.rule_id],source_ids:[...list(rule.source_ids)],
    training_triggers:[rule.training_trigger],frequencies:[rule.frequency],
    minimum_durations:[rule.minimum_duration],competence_levels:[rule.competence_level],
    assessment_requirements:[rule.assessment_requirement],record_requirements:[rule.record_requirement],
    internal_review_required:rule.internal_review_required!==false
  };
}

function mergeRequirement(existing,rule){
  if(LEVEL_RANK[rule.requirement_level]>LEVEL_RANK[existing.requirement_level])existing.requirement_level=rule.requirement_level;
  if(PRIORITY_RANK[rule.priority]<PRIORITY_RANK[existing.priority])existing.priority=rule.priority;
  existing.reasons=unique([...existing.reasons,rule.reason]);
  existing.rule_ids=unique([...existing.rule_ids,rule.rule_id]);
  existing.source_ids=unique([...existing.source_ids,...list(rule.source_ids)]);
  existing.training_triggers=unique([...existing.training_triggers,rule.training_trigger]);
  existing.frequencies=unique([...existing.frequencies,rule.frequency]);
  existing.minimum_durations=unique([...existing.minimum_durations,rule.minimum_duration]);
  existing.competence_levels=unique([...existing.competence_levels,rule.competence_level]);
  existing.assessment_requirements=unique([...existing.assessment_requirements,rule.assessment_requirement]);
  existing.record_requirements=unique([...existing.record_requirements,rule.record_requirement]);
  existing.internal_review_required=existing.internal_review_required||rule.internal_review_required!==false;
}

export function generateMatrix(profile,data){
  const roleMap=new Map(data.roles.map(x=>[x.id,x]));
  const topicMap=new Map(data.topics.map(x=>[x.topic_id,x]));
  const sourceMap=new Map(data.sources.map(x=>[x.source_id,x]));
  const roleIds=unique(list(profile.roles)).filter(id=>roleMap.has(id));
  const out=new Map();
  for(const rule of data.rules){
    if(!matchRule(rule,profile))continue;
    const allowedRoles=list(rule.roles_any);
    const targets=allowedRoles.length?roleIds.filter(id=>allowedRoles.includes(id)):roleIds;
    for(const roleId of targets){
      const topic=topicMap.get(rule.topic_id),role=roleMap.get(roleId);
      if(!topic||!role)continue;
      const key=`${roleId}|${rule.topic_id}`,existing=out.get(key);
      if(existing)mergeRequirement(existing,rule);else out.set(key,requirementFromRule(rule,role,topic));
    }
  }
  const requirements=[...out.values()].map(item=>{
    const cleaned={...item};
    for(const key of ['training_triggers','frequencies','minimum_durations','competence_levels','assessment_requirements','record_requirements'])cleaned[key]=unique(cleaned[key]);
    cleaned.sources=cleaned.source_ids.map(id=>sourceMap.get(id)).filter(Boolean);
    cleaned.source_statuses=unique(cleaned.sources.map(source=>source.status));
    return cleaned;
  });
  const custom=cleanCustomRole(profile.customRole);
  if(custom){
    roleIds.push('custom');
    const topic=topicMap.get('job_sop'),source=sourceMap.get('risk_review');
    requirements.push({role_id:'custom',role_name:custom,topic_id:'job_sop',topic,requirement_level:'recommended',priority:'medium',reasons:['自定义岗位需要结合实际职责、风险和操作规程建立培训要求。'],rule_ids:['CUSTOM-REVIEW'],source_ids:['risk_review'],sources:source?[source]:[],source_statuses:['needs_review'],training_triggers:['上岗前及岗位、风险或规程变化时'],frequencies:['上岗/变化触发'],minimum_durations:[],competence_levels:['practical'],assessment_requirements:['岗位知识与实操确认'],record_requirements:['培训与岗位授权记录'],internal_review_required:true});
  }
  requirements.sort((a,b)=>a.role_name.localeCompare(b.role_name,'zh-CN')||LEVEL_RANK[b.requirement_level]-LEVEL_RANK[a.requirement_level]||a.topic.title_zh.localeCompare(b.topic.title_zh,'zh-CN'));
  return {
    profile:{...profile,roles:roleIds,customRole:custom},requirements,
    roles:roleIds.map(id=>id==='custom'?{id,name:custom}:roleMap.get(id)).filter(Boolean),
    topics:[...new Map(requirements.map(x=>[x.topic_id,x.topic])).values()],
    generated_at:new Date().toISOString(),version:data.version||'0.2.0',verified_at:data.verified_at||null
  };
}

export function statusCode(level){return ({mandatory:'M',conditional:'C',recommended:'R'})[level]||'N/A';}
export function buildPlan(result){
  return result.requirements.map((r,i)=>({
    window:r.frequencies.join('；')||'由企业基于风险确定',topic:r.topic.title_zh,role:r.role_name,
    trigger:r.training_triggers.join('；'),method:r.topic.delivery_methods.join('、'),
    owner:r.role_id==='principal'?'董事会/上级管理者':'岗位主管/EHS',
    assessment:unique([...r.assessment_requirements,...r.topic.assessment_methods]).join('；'),
    status:'待计划',note:r.minimum_durations.length?`最低学时：${r.minimum_durations.join('；')}`:'需企业内部复核',order:i+1
  }));
}

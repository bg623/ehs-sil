(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceWorkflow=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const PROJECT_SCHEMA="1.0.0";
  function requiredMissing(e){const missing=["基本符合","不符合"].includes(e.judgment)?[["gap","差距分析"],["action","整改措施"],["owner","责任人"],["due","计划完成日期"]].filter(([key])=>!String(e[key]||"").trim()).map(([,label])=>label):[];if(e.judgment==="符合"&&!String(e.evidence||"").trim())missing.push("符合判定的客观证据");if(e.judgment==="不适用"&&!String(e.evidence||"").trim())missing.push("不适用的范围依据");return missing;}
  function evaluationStatus(e,today,daysBetween){if(e.judgment==="待评价"||!e.judgment)return "未开始";if(["符合","不适用"].includes(e.judgment))return "已关闭";if(e.completedAt&&e.verification)return "已关闭";if(e.completedAt)return "待验证";const days=e.due?daysBetween(today,e.due):null;if(days!==null&&days<0)return `已逾期 ${Math.abs(days)} 天`;return "整改中";}
  function createProject({profile,selected,evaluations,addedUpdates,updatedAt}){return {schemaVersion:PROJECT_SCHEMA,tool:"EHS-SIL Compliance Identification",profile,selectedRegulationIds:Object.entries(selected).filter(([,value])=>value).map(([id])=>id),evaluations,addedUpdates:addedUpdates||[],dynamicRecords:{},updatedAt:updatedAt||new Date().toISOString()};}
  function validateProject(project){if(!project||typeof project!=="object")throw Error("项目文件不是有效对象");if(project.schemaVersion!==PROJECT_SCHEMA)throw Error(`不支持的项目版本：${project.schemaVersion||"缺失"}`);if(!project.profile||typeof project.profile!=="object")throw Error("项目文件缺少企业画像");if(!Array.isArray(project.selectedRegulationIds))throw Error("项目文件缺少已选法规");if(!project.evaluations||typeof project.evaluations!=="object"||Array.isArray(project.evaluations))throw Error("项目文件缺少评价记录");if(project.addedUpdates!==undefined&&!Array.isArray(project.addedUpdates))throw Error("项目文件的动态法规记录格式无效");return project;}
  const legacyValidateProject=validateProject;
  function validateSafeProject(project){
    legacyValidateProject(project);
    const walk=(value,depth=0)=>{if(depth>12)throw Error("项目嵌套过深");if(value&&typeof value==="object")for(const [key,v] of Object.entries(value)){if(["__proto__","constructor","prototype"].includes(key))throw Error("项目含不安全字段");walk(v,depth+1);}};
    walk(project);
    const p=project.profile;
    if(Array.isArray(p))throw Error("企业画像应为对象");
    for(const field of ["enterpriseTypes","industries","riskTags","specialOperationTypes","hazardousActivities","hazardousWasteActivities","specialEquipmentTypes","industryAttributes","managementCommitments","environmentalActivities","regulatoryAttributes","workplaceActivities"])if(p[field]!==undefined&&(!Array.isArray(p[field])||p[field].length>200||p[field].some(v=>typeof v!=="string"||v.length>160)))throw Error(`画像字段无效：${field}`);
    if(p.answers!==undefined&&(!p.answers||typeof p.answers!=="object"||Array.isArray(p.answers)||Object.values(p.answers).some(v=>!["yes","no","unknown"].includes(v))))throw Error("画像追问回答无效");
    if(project.selectedRegulationIds.length>1000||project.selectedRegulationIds.some(v=>typeof v!=="string"||!/^[-A-Za-z0-9_]+$/.test(v)))throw Error("法规编号无效");
    for(const e of Object.values(project.evaluations)){if(!e||typeof e!=="object"||Array.isArray(e))throw Error("评价记录格式无效");if(e.judgment!==undefined&&!["待评价","符合","基本符合","不符合","不适用"].includes(e.judgment))throw Error("评价判定无效");}
    return project;
  }
  return {PROJECT_SCHEMA,requiredMissing,evaluationStatus,createProject,validateProject:validateSafeProject};
});

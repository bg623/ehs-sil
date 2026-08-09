(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JsaDraftGenerator=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  function unique(values){
    return values.filter(function(value,index,array){return value&&array.indexOf(value)===index});
  }

  function containsAny(text,keywords){
    return (keywords||[]).some(function(keyword){return text.indexOf(String(keyword).toLowerCase())!==-1});
  }

  function inferContext(taskText,data){
    var text=String(taskText||'').trim().toLowerCase();
    var scenarios=[];
    var tags=[];
    Object.keys(data.scenario_keywords||{}).forEach(function(key){
      if(containsAny(text,data.scenario_keywords[key]))scenarios.push(key);
    });
    Object.keys(data.energy_keywords||{}).forEach(function(key){
      if(containsAny(text,data.energy_keywords[key]))tags.push(key);
    });
    return {
      scenarios:unique(scenarios),
      tags:unique(tags),
      contractor_work:/承包商|外包|施工队|供应商/.test(text),
      simultaneous_operations:/同时作业|交叉作业|并行作业|多工种/.test(text),
      non_routine:/非例行|临时作业|抢修|首次|紧急/.test(text)
    };
  }

  function cloneStep(step){
    return {
      key:step.key,
      phase:Number(step.phase||50),
      desc:String(step.desc||''),
      hazard:String(step.hazard||''),
      existingCtrl:String(step.existingCtrl||''),
      addCtrl:String(step.addCtrl||''),
      L:Number(step.L||3),
      S:Number(step.S||3),
      source:'auto_suggestion'
    };
  }

  function createDraft(options,data){
    options=options||{};
    data=data||{};
    var taskText=[options.jobName||'',options.taskDescription||''].join(' ').trim();
    var inferred=inferContext(taskText,data);
    var scenarios=unique((options.scenarios||[]).concat(inferred.scenarios));
    var tags=unique((options.tags||[]).concat(inferred.tags));
    var profiles=scenarios.length?scenarios:['generic'];
    var candidates=[];
    (data.common_steps||[]).forEach(function(step){candidates.push(cloneStep(step))});
    profiles.forEach(function(profile){
      (data.scenario_steps&&data.scenario_steps[profile]||[]).forEach(function(step){candidates.push(cloneStep(step))});
    });
    var byKey={};
    candidates.forEach(function(step){if(!byKey[step.key])byKey[step.key]=step});
    var ordered=Object.keys(byKey).map(function(key){return byKey[key]}).sort(function(a,b){return a.phase-b.phase});
    var closing=(data.closing_steps||[]).map(cloneStep);
    var steps=ordered.concat(closing).map(function(step,index){
      step.step=index+1;
      step.R=step.L*step.S;
      return step;
    });
    return {
      taskText:taskText,
      scenarios:scenarios,
      tags:tags,
      contractor_work:Boolean(options.contractor_work||inferred.contractor_work),
      simultaneous_operations:Boolean(options.simultaneous_operations||inferred.simultaneous_operations),
      non_routine:Boolean(options.non_routine||inferred.non_routine),
      steps:steps,
      notice:data.review_note||'自动生成内容为建议草稿，须由使用者结合现场逐项修改确认。'
    };
  }

  return {inferContext:inferContext,createDraft:createDraft};
});

import {CONDITION_LABELS} from './schema.mjs';
export function checkConditions(project,definition){
  const conditions=project.inputs.scenario.conditions;
  const missing=definition.conditions.filter(k=>conditions[k]==='unknown').map(k=>CONDITION_LABELS[k]);
  const contrary=definition.conditions.filter(k=>conditions[k]==='no').map(k=>CONDITION_LABELS[k]);
  return {status:missing.length||contrary.length?'insufficient_data':'candidate',missing,contrary,explanation:contrary.length?'当前记录含不满足的前提，请复核场景边界；本工具不能据此排除其他失效路径。':missing.length?'请补充条件；模型未支持不代表事故不可能发生。':'可列为候选场景，仍需专业人员核实实际条件。'};
}

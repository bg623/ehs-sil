// Mathematical primitives only. These tests confer no real-pool validation.
export function idealPointFlux(qWatts,distanceM,transmissivity=1){
  if(![qWatts,distanceM,transmissivity].every(Number.isFinite)||qWatts<0||distanceM<=0||transmissivity<0||transmissivity>1)throw Error('理想源输入无效');
  return qWatts*transmissivity/(4*Math.PI*distanceM**2)/1000;
}
export function massBalance(massKg,areaM2,fluxKgM2S,timeS=0){
  if(![massKg,areaM2,fluxKgM2S,timeS].every(Number.isFinite)||massKg<0||areaM2<=0||fluxKgM2S<=0||timeS<0)throw Error('质量收支输入无效');
  const rate=areaM2*fluxKgM2S,duration=massKg/rate;
  return {rateKgS:rate,durationS:duration,consumedKg:Math.min(massKg,rate*timeS),remainingKg:Math.max(0,massKg-rate*timeS)};
}
export function screeningGate(project,registry,capabilities,chemical){
  const reasons=[];
  if(!capabilities.screeningEnabled)reasons.push('PROJECT_SCREENING_NOT_RELEASED');
  if(registry.reviewStatus!=='reviewed'||!registry.technicalReview||!registry.validationEvidence.length)reasons.push('MODEL_EVIDENCE_INCOMPLETE');
  if(!chemical||chemical.synthetic||chemical.reviewStatus!=='reviewed')reasons.push('PROPERTIES_NOT_REVIEWED');
  if(project.inputs.material.composition!=='pure')reasons.push('MIXTURE_OR_IDENTITY_UNCONFIRMED');
  if(project.inputs.material.state!=='liquid')reasons.push('PHASE_OUTSIDE_SCOPE');
  if(!registry.dataCompatibility.includes(capabilities.dataVersion))reasons.push('DATA_VERSION_MISMATCH');
  // This draft deliberately has no production distance solver or validated near-field boundary.
  reasons.push('NEAR_FIELD_AND_POOL_VALIDATION_PENDING');
  return {status:'not_evaluated',reasons};
}

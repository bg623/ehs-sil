const clampSize=(n,fallback)=>Number.isInteger(n)&&n>=320&&n<=4096?n:fallback;
/** The supplied capture must synchronously re-render the actual 3D scene. */
export async function exportFrame({width=1920,height=1080,labels=false,capture,metadata,labelSnapshot=[]}) {
  width=clampSize(width,1920);height=clampSize(height,1080);
  if(width*height>9437184)throw Error('导出尺寸超过本版本预算');
  const frozen=structuredClone(metadata),canvas=capture(width,height),context=canvas.getContext('2d');
  if(!context)throw Error('PNG画布不可用');
  const scale=width/1920;
  if(labels){
    context.font=`${Math.max(12,Math.round(18*scale))}px system-ui,sans-serif`;context.textBaseline='top';
    for(const label of typeof labelSnapshot==='function'?labelSnapshot(width,height):labelSnapshot){
      if(!label.visible)continue;const x=Math.max(12,Math.min(width-180*scale,label.x)),y=Math.max(12,Math.min(height-90*scale,label.y));
      const w=Math.min(320*scale,context.measureText(label.text).width+20*scale);
      context.fillStyle='rgba(243,248,245,.9)';context.fillRect(x,y,w,30*scale);context.fillStyle='#174b41';context.fillText(label.text,x+10*scale,y+5*scale);
    }
  }
  const font=Math.max(13,Math.round(18*scale));context.font=`${font}px system-ui,sans-serif`;context.textBaseline='bottom';
  const lines=[`EHS-SIL · ${frozen.material.name} · ${frozen.scenario.name}`,`${frozen.assisted?'教学可见性辅助':'自然外观示意'} · 写实演示 / 非项目计算 · V${frozen.appVersion}`];
  const pad=18*scale,barHeight=font*3+pad;
  context.fillStyle='rgba(14,38,33,.78)';context.fillRect(0,height-barHeight,width,barHeight);context.fillStyle='#f4f7f5';
  context.fillText(lines[0],pad,height-pad-font*1.35);context.fillStyle='#c4d9d0';context.fillText(lines[1],pad,height-pad);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('PNG编码失败')),'image/png'));
  return {blob,metadata:{...frozen,sourceCamera:frozen.camera,camera:{...frozen.camera,aspect:width/height},width,height,labels:Boolean(labels),pixels:'actual-3d-high-resolution-rerender',mime:'image/png'}};
}

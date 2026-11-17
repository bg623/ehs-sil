import * as THREE from 'three';
/** Authored daylight radiance, no third-party HDRI or network resource. */
export function createDaylightEnvironment(renderer,lifecycle) {
  const source=new THREE.Scene(),geometry=new THREE.SphereGeometry(30,24,12);
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,toneMapped:false,vertexShader:'varying float elevation;void main(){elevation=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying float elevation;void main(){vec3 ground=vec3(.22,.25,.23),horizon=vec3(.9,.95,1.0),zenith=vec3(.52,.7,.94);vec3 radiance=mix(ground,horizon,smoothstep(-.35,.12,elevation));radiance=mix(radiance,zenith,smoothstep(.12,1.,elevation));gl_FragColor=vec4(radiance,1.);}'});
  source.add(new THREE.Mesh(geometry,material));lifecycle.createdGeometry();lifecycle.createdMaterial();
  const panelGeometry=new THREE.PlaneGeometry(9,9),panelMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(3.0,2.8,2.5),side:THREE.DoubleSide,toneMapped:false}),panel=new THREE.Mesh(panelGeometry,panelMaterial);panel.position.set(8,18,10);panel.lookAt(0,0,0);source.add(panel);lifecycle.createdGeometry();lifecycle.createdMaterial();
  const generator=new THREE.PMREMGenerator(renderer);let target;
  try{target=generator.fromScene(source,.04,.1,100);}finally{generator.dispose();geometry.dispose();material.dispose();panelGeometry.dispose();panelMaterial.dispose();lifecycle.disposedGeometry();lifecycle.disposedGeometry();lifecycle.disposedMaterial();lifecycle.disposedMaterial();source.clear();}
  lifecycle.createdTexture?.();
  return {texture:target.texture,stats(){const image=target.texture.image;return {kind:'authored-procedural-daylight-pmrem',width:image.width,height:image.height,estimatedBytes:image.width*image.height*8};},dispose(){target.dispose();lifecycle.disposedTexture?.();}};
}

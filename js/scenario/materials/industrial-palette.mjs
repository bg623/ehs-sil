import * as THREE from 'three';

// Original, deterministic surface art. These values are not material-property data.
export function createGrainTexture(kind='concrete',size=64){
 const bytes=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 const random=(x,y)=>{const f=Math.sin(x*127.1+y*311.7+17.19)*43758.5453;return f-Math.floor(f);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)height[y*size+x]=kind==='metal'? .5+.19*Math.sin(y*.61)+.12*random(x,y):.5+.33*(random(x,y)-.5)+.08*Math.sin(x*.41+y*.36);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,h=height[y*size+x];
  if(kind==='normal'||kind==='liquid'){
   const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
   bytes[i]=128+Math.round(dx*40);bytes[i+1]=128+Math.round(dy*40);bytes[i+2]=255;
  }else{const grain=Math.round((kind==='metal'?.70:.82)*255+(h-.5)*(kind==='metal'?42:30));bytes[i]=grain;bytes[i+1]=grain;bytes[i+2]=grain;}
  bytes[i+3]=255;
 }
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.repeat.set(kind==='metal'?4:6,kind==='metal'?2:6);texture.needsUpdate=true;return texture;
}

export function createContactTexture(size=64){
 const bytes=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
  bytes[i]=bytes[i+1]=bytes[i+2]=255;bytes[i+3]=Math.round(255*Math.pow(Math.max(0,1-r),1.4));
 }
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

export function createIndustrialPalette({material,texture}){
 const grain=texture(createGrainTexture('metal')),normal=texture(createGrainTexture('normal')),concreteGrain=texture(createGrainTexture('concrete')),contact=texture(createContactTexture());
 const standard=(color,settings={})=>material(new THREE.MeshStandardMaterial({color,roughness:.6,metalness:.05,...settings}));
 return {
  steel:standard('#8c969c',{metalness:.82,roughness:.32,roughnessMap:grain,normalMap:normal,normalScale:new THREE.Vector2(.12,.12)}),
  darkSteel:standard('#3c484e',{metalness:.75,roughness:.42,roughnessMap:grain}),
  paleSteel:standard('#b9bfc0',{metalness:.72,roughness:.38,normalMap:normal,normalScale:new THREE.Vector2(.06,.06)}),
  painted:standard('#657773',{metalness:.3,roughness:.58,normalMap:normal,normalScale:new THREE.Vector2(.04,.04)}),
  concrete:standard('#c4c1b7',{roughness:.94,metalness:0,roughnessMap:concreteGrain,normalMap:normal,normalScale:new THREE.Vector2(.18,.18)}),
  ground:standard('#aaa99e',{roughness:.96,metalness:0,roughnessMap:concreteGrain,normalMap:normal,normalScale:new THREE.Vector2(.12,.12)}),
  yellow:standard('#c4a345',{metalness:.24,roughness:.64}),red:standard('#8f3d32',{metalness:.34,roughness:.47}),black:standard('#202c30',{metalness:.2,roughness:.58}),
  indicator:standard('#526e6a',{metalness:.18,roughness:.33}),
  contact:material(new THREE.MeshBasicMaterial({color:'#25251f',map:contact,transparent:true,opacity:.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})),
  ghost:material(new THREE.LineBasicMaterial({color:'#8c9d9d',transparent:true,opacity:.48,depthWrite:false})),
 };
}

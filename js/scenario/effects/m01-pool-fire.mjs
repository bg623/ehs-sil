// Adapted from the user-supplied Kimi M01 effects.js (2026-11-24).
// The field is sampled by EHS-SIL's existing opaque-depth-terminated ray marcher.
// No private renderer, clock, engineering source term or approval state is added.
export const m01PoolFireField = `
float m01Hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float m01Noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(m01Hash(i),m01Hash(i+vec3(1,0,0)),f.x),mix(m01Hash(i+vec3(0,1,0)),m01Hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(m01Hash(i+vec3(0,0,1)),m01Hash(i+vec3(1,0,1)),f.x),mix(m01Hash(i+vec3(0,1,1)),m01Hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float m01Fbm(vec3 p){return m01Noise(p)*.56+m01Noise(p*2.03+17.1)*.29+m01Noise(p*4.07-9.4)*.15;}
Field m01PoolFire(vec3 p){
 Field f=emptyField();
 float t=uM01Progress,T=t*18.;
 float growth=smoothstep(.475,.72,t)*(1.-smoothstep(.87,1.,t)*.83)*.94;
 float life=smoothstep(.46,.52,t)*(1.-smoothstep(.875,1.,t)*.92);
 float spread=-.06+smoothstep(.46,.605,t)*1.75;
 vec3 local=p-uRoot;
 float ratio=uRadius/1.2,H=4.8*ratio,h=local.y/H;
 if(h<0.||h>growth||any(greaterThan(abs(local.xz),vec2(1.7*ratio))))return f;
 vec2 q=local.xz/(1.7*ratio);
 vec2 advected=q-vec2(sin(h*7.-T*1.9)*.10*h,cos(h*5.+T*1.4)*.09*h);
 float n=m01Fbm(vec3(advected*3.2,h*4.2-T*.72));
 float radius=mix(.60,.035,pow(h,.74))+(n-.48)*.23+sin(h*19.+n*8.)*.030;
 float body=smoothstep(0.,.42,radius-length(advected));
 float breakup=smoothstep(.30,.68,n+(1.-h)*.18);
 float tip=1.-smoothstep(max(0.,growth-.20),growth,h);
 float root=smoothstep(0.,.035,h+.02);
 float ignition=1.-smoothstep(spread,spread+.26,length(q-vec2(-.38,-.10)));
 f.fire=body*mix(.20,1.,breakup)*tip*root*ignition*life;
 f.heat=1.-h;
 return f;
}`;

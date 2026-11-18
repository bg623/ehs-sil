export const NOISE_VERSION = 'xorshift32-r8-v1';
export const NOISE_SIZE = 64;
export const NOISE_SEED = 0x7f4a7c15;
/** Deterministic, periodic R8 source bytes, no runtime randomness or dependencies. */
export function makeNoiseVolume(size=NOISE_SIZE,seed=NOISE_SEED) {
  if(!Number.isInteger(size)||size<4||size>128)throw Error('噪声体分辨率无效');
  const data=new Uint8Array(size**3);let state=seed|0;
  for(let i=0;i<data.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=state>>>24;}
  return data;
}

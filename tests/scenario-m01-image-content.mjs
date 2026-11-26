import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';

// Decode native Chromium RGB/RGBA PNG bytes, independently of the browser's
// WebGL drawing buffer. Text footers and viewport notes are excluded so a large
// blank export cannot pass merely because its dimensions and file size are valid.
export function imageContent(bytes,name='image') {
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],type=bytes[25],interlace=bytes[28];
  assert.equal(depth,8);assert.ok(type===2||type===6);assert.equal(interlace,0);assert.ok(width*height<=16000000);
  const channels=type===2?3:4,rowBytes=width*channels,chunks=[];
  for(let offset=8;offset<bytes.length;) {
    const length=bytes.readUInt32BE(offset),kind=bytes.toString('ascii',offset+4,offset+8);
    assert.ok(offset+length+12<=bytes.length);if(kind==='IDAT')chunks.push(bytes.subarray(offset+8,offset+8+length));offset+=length+12;
  }
  const expected=height*(rowBytes+1),raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});assert.equal(raw.length,expected);
  let prior=Buffer.alloc(rowBytes),cursor=0;const colours=new Set();let min=255,max=0,samples=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++) {
    const filter=raw[cursor++],row=Buffer.allocUnsafe(rowBytes);assert.ok(filter<=4);
    for(let i=0;i<rowBytes;i++) {
      const left=i>=channels?row[i-channels]:0,up=prior[i],upperLeft=i>=channels?prior[i-channels]:0;
      const predicted=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);
      row[i]=(raw[cursor++]+predicted)&255;
    }
    if(y>height*.04&&y<height*.84&&y%3===0)for(let x=Math.ceil(width*.04);x<width*.96;x+=3) {
      const at=x*channels;if(channels===4&&row[at+3]<20)continue;
      const [r,g,b]=row.subarray(at,at+3);min=Math.min(min,r,g,b);max=Math.max(max,r,g,b);
      colours.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));samples++;
    }
    prior=row;
  }
  const result={name,width,height,samples,quantizedColours:colours.size,channelRange:max-min,crop:'middle 92% width, 4%-84% height; excludes footer and lower note'};
  assert.ok(samples>1000,`${name}: insufficient image samples`);
  assert.ok(colours.size>20&&max-min>35,`${name}: empty or near-flat render (${JSON.stringify(result)})`);
  return result;
}

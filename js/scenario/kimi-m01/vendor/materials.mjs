// Adapted from user-supplied Kimi M01 source (2026-11-24); original attachment retained read-only.
import * as THREE from 'three';
import { mulberry32 } from './config.mjs';

function canvasTexture(size, draw, colorSpace = THREE.SRGBColorSpace) {
  // Node component QA still allocates a real disposable texture, not a mocked
  // material. Browser previews use the supplier canvas artwork below.
  if(typeof document==='undefined'){
    const pixels=new Uint8Array(size*size*4);
    const random=mulberry32(8102);
    for(let i=0;i<pixels.length;i+=4){const v=168+Math.round((random()-.5)*25);pixels.set([v,v+2,v,255],i);}
    const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
    texture.colorSpace=colorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.needsUpdate=true;texture.userData.qaFallback='node-without-canvas';
    return texture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function createMaterials() {
  const concreteMap = canvasTexture(256, (ctx, s) => {
    const random = mulberry32(8102);
    ctx.fillStyle = '#a9aaa5';
    ctx.fillRect(0, 0, s, s);
    const image = ctx.getImageData(0, 0, s, s);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = (random() - 0.5) * 30;
      image.data[i] += n;
      image.data[i + 1] += n;
      image.data[i + 2] += n * 0.85;
    }
    ctx.putImageData(image, 0, 0);
    ctx.strokeStyle = 'rgba(65,68,65,.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = random() * s, y = random() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 36, y + (random() - 0.5) * 36);
      ctx.stroke();
    }
  });
  concreteMap.repeat.set(5, 5);

  const metalMap = canvasTexture(256, (ctx, s) => {
    const random = mulberry32(5108);
    ctx.fillStyle = '#d8dcd9';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x++) {
      const shade = 202 + Math.floor(random() * 28);
      ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 1},.18)`;
      ctx.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 32; i++) {
      const y = random() * s;
      ctx.fillStyle = 'rgba(85,96,96,.035)';
      ctx.fillRect(0, y, s, 1 + random() * 2);
    }
  });
  metalMap.repeat.set(3, 1);

  return {
    tank: new THREE.MeshStandardMaterial({ color: 0xdde2de, map: metalMap, metalness: 0.55, roughness: 0.38 }),
    tankRoof: new THREE.MeshStandardMaterial({ color: 0xc5cfcd, metalness: 0.62, roughness: 0.34 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x87979a, metalness: 0.78, roughness: 0.3 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x405157, metalness: 0.72, roughness: 0.36 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0xaeb9b8, metalness: 0.8, roughness: 0.28 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb8b8b0, map: concreteMap, roughness: 0.92, metalness: 0.02 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x888d89, map: concreteMap, roughness: 0.96 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8352d, metalness: 0.45, roughness: 0.38 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd6a928, metalness: 0.32, roughness: 0.48 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.88 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xb8d5d8, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0, depthWrite: false }),
    gaugeLiquid: new THREE.MeshStandardMaterial({ color: 0x3c8e9b, transparent: true, opacity: 0.65, roughness: 0.2 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x6f7775, roughness: 1 }),
    whitePaint: new THREE.MeshStandardMaterial({ color: 0xe5e5dc, roughness: 0.65 }),
  };
}

export function makeTextTexture(lines, options = {}) {
  const width = options.width || 768;
  const height = options.height || 512;
  if(typeof document==='undefined'){
    const texture=new THREE.DataTexture(new Uint8Array([230,233,227,255]),1,1,THREE.RGBAFormat);
    texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    texture.userData={qaFallback:'node-without-canvas',textLines:lines.map(line=>line.text)};
    return texture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.background || '#e6e9e3';
  ctx.fillRect(0, 0, width, height);
  if (options.border !== false) {
    ctx.strokeStyle = options.accent || '#247482';
    ctx.lineWidth = 18;
    ctx.strokeRect(12, 12, width - 24, height - 24);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const size = line.size || (i === 0 ? 92 : 54);
    ctx.font = `${line.weight || 600} ${size}px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = line.color || '#18323a';
    ctx.fillText(line.text, width / 2, line.y ?? height * (i + 1) / (lines.length + 1));
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeLabelSprite(text, accent = '#71d5e2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(17,35,43,.90)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 116, 18);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(6, 6, 9, 116);
  ctx.font = '600 39px "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#edf4f2';
  ctx.fillText(text, 262, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 0.65, 1);
  sprite.renderOrder = 8;
  return sprite;
}

export function createEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#6f96b2');
  gradient.addColorStop(0.47, '#d6e0df');
  gradient.addColorStop(0.54, '#c6c9bd');
  gradient.addColorStop(1, '#77796e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  const sun = ctx.createRadialGradient(250, 120, 2, 250, 120, 95);
  sun.addColorStop(0, 'rgba(255,250,224,1)');
  sun.addColorStop(0.08, 'rgba(255,244,205,.9)');
  sun.addColorStop(1, 'rgba(255,244,205,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(texture).texture;
  texture.dispose();
  pmrem.dispose();
  return env;
}


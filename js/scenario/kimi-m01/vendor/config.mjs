// Adapted from user-supplied Kimi M01 source (2026-11-24); original attachment retained read-only.
import * as THREE from 'three';

export const SEED = 20261124;
export const DURATION = 1;
export const TANK = Object.freeze({ radius: 2, height: 4, baseY: 0.22, inventory: 30, level: 2.39 });
export const BUND = Object.freeze({ length: 12, width: 10, height: 1, wall: 0.18 });
export const POOL = Object.freeze({ radius: 1.2, center: new THREE.Vector3(0.9, 0.035, 4.0) });
export const ANCHORS = Object.freeze({
  Anchor_TankBase: [0, 0.22, 0],
  Anchor_Leak: [0.9, 0.72, 3.08],
  Anchor_Pool: [0.9, 0.035, 4.0],
});

export const PHASES = Object.freeze([
  { at: 0, end: 0.12, name: '正常设备与库存', short: '正常', description: '固定顶常压罐与根部阀保持正常状态；液位为教学示意。' },
  { at: 0.12, end: 0.28, name: '阀后泄漏', short: '泄漏', description: '短管在根部阀后出现液流，受重力弯曲下落并产生少量飞沫。' },
  { at: 0.28, end: 0.46, name: '液池形成', short: '液池', description: '湿润前沿从实际落点连续铺展，最终半径 1.2 m 为视觉预设。' },
  { at: 0.46, end: 0.60, name: '局部点燃', short: '点火', description: '液池局部表面点燃，燃烧面从明确起点逐步扩展。' },
  { at: 0.60, end: 0.86, name: '池火发展', short: '发展', description: '淡蓝火焰上升、卷吸、分裂与翻卷；低烟尘，不代表无热危险。' },
  { at: 0.86, end: 1.001, name: '减弱与回顾', short: '回顾', description: '预设供料减弱，液流与地面残留分别过渡；不据此宣称隔离成功。' },
]);

export function mulberry32(seed) {
  let a = seed;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(SEED);
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smooth = (a, b, v) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const phaseAt = (p) => PHASES.findIndex((phase) => p >= phase.at && p < phase.end);


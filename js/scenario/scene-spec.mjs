import { clone } from "./schema.mjs";
import { deriveQuantity } from "./presets.mjs";
import { checkCompatibility } from "./compatibility.mjs";
export function buildSceneSpec(p, c) {
  const d = c.scenarios.scenarios.find((x) => x.id === p.inputs.scenario.id);
  if (!d) throw Error("事故机制未提供，不能回退为池火");
  const material = clone(p.inputs.material),
    eq = clone(p.inputs.equipment),
    q = deriveQuantity(p),
    support = checkCompatibility(p, c),
    D = eq.geometry.diameterM;
  const known = D !== null && eq.leakAnchor !== null;
  eq.anchors = {
    tank: { x: 0, y: 0, z: 0 },
    outlet: known ? { x: D / 2 + 0.12, y: 0, z: 0.55 } : null,
    rootValve: known ? { x: D / 2 + 0.65, y: 0, z: 0.55 } : null,
    leak: known ? { x: D / 2 + 1.15, y: 0, z: 0.48 } : null,
    poolCenter: known ? { x: D / 2 + 1.95, y: 0, z: 0.03 } : null,
  };
  if (known && eq.leakAnchor === "tank-wall") {
    const angle = -Math.PI / 6;
    eq.anchors.leak = {
      x: (D / 2) * Math.cos(angle),
      y: (D / 2) * Math.sin(angle),
      z: 0.6,
    };
    eq.anchors.poolCenter = {
      x: (D / 2 + 1.8) * Math.cos(angle),
      y: (D / 2 + 1.8) * Math.sin(angle),
      z: 0.03,
    };
  }
  eq.liquidLevelM = q.liquidLevelM;
  const specific = material.composition === "pure",
    profile =
      c.visualProfiles.profiles.find(
        (x) =>
          x.id === (specific ? material.visualProfileRef : "generic-pool-fire"),
      ) || c.visualProfiles.profiles.find((x) => x.id === "generic-pool-fire");
  if (!profile) throw Error("通用视觉规则缺失");
  const mode = p.ui.visualMode,
    note =
      mode === "assisted"
        ? "为便于教学已增强轮廓，不代表真实目视效果"
        : "外观示意，非实测影像";
  const stages = support.canPlayDetailedStoryboard
    ? d.stages || c.scenarios.stages
    : [
        {
          title: `${d.name}机制`,
          text: d.mechanism,
          question: support.issues[0]?.message || d.difference,
          highlight: "mechanism",
        },
      ];
  return {
    sceneId: d.id,
    title: p.meta.title,
    material,
    equipment: eq,
    quantityDerived: q,
    pool: {
      radiusM: p.inputs.pool.radiusM,
      geometrySource: p.inputs.pool.geometrySource,
    },
    visual: { profile: clone(profile), mode, note },
    support,
    scenario: clone(d),
    stages: clone(stages),
    receptors: clone(p.inputs.receptors),
    inputRevision: p.inputRevision,
  };
}
export function sampleStoryboard(spec, progress, seed = 1) {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)),
    n = spec.stages.length,
    index = Math.min(n - 1, Math.floor(p * n)),
    stageProgress = p === 1 ? 1 : p * n - index,
    detailed = spec.support.canPlayDetailedStoryboard;
  return {
    progress: p,
    stage: index,
    stageProgress,
    leakVisible: detailed && index >= 1,
    poolVisible: detailed && index >= 2,
    fireVisible: detailed && index >= 3,
    poolScale: index < 2 ? 0 : index === 2 ? 0.15 + 0.85 * stageProgress : 1,
    fireGrowth: index < 3 ? 0 : index === 3 ? 0.15 + 0.85 * stageProgress : 1,
    noiseTime: p * 13 + (seed % 997) * 0.001,
    highlight:
      spec.stages[index]?.highlight ||
      ["tank", "leak", "pool", "fire", "controls", "review"][index],
  };
}

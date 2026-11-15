import { worldToScreen } from "./coordinates.mjs";

export const escape = (value) =>
  String(value ?? "未填写").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const short = (text, max = 34) => String(text ?? "").slice(0, max);
const number = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function visualStyle(spec) {
  const profile = spec?.visual?.profile || {};
  const pure = spec?.material?.composition === "pure";
  const mode = spec?.visual?.mode === "natural" ? "natural" : "assisted";
  const color =
    pure && /^#[0-9a-f]{6}$/i.test(profile.color) ? profile.color : "#a6b8bd";
  const opacity = pure
    ? number(
        mode === "natural" ? profile.naturalOpacity : profile.assistedOpacity,
        0.5,
      )
    : 0.5;
  return {
    color,
    opacity: clamp(opacity, 0.08, 0.95),
    mode,
    note:
      mode === "natural"
        ? "自然外观示意 · 非实测影像"
        : "可见性辅助 · 已增强轮廓，不代表真实目视效果",
  };
}

function poolPlan(spec, frame, style) {
  const equipment = spec.equipment || {},
    geometry = equipment.geometry || {};
  const containment = equipment.containment || {},
    anchors = equipment.anchors || {};
  const origin = anchors.tank || { x: 0, y: 0, z: 0 };
  const length = number(containment.lengthM, 12),
    width = number(containment.widthM, 10);
  const scale = Math.min(600 / Math.max(length, 1), 245 / Math.max(width, 1));
  const point = (p) => {
    const [x, y] = worldToScreen(
      { x: number(p?.x) - origin.x, y: number(p?.y) - origin.y },
      scale,
    );
    return [x + 90, y + 42];
  };
  const [tx, ty] = point(origin),
    radius = (number(geometry.diameterM, 3) * scale) / 2;
  const tank =
    geometry.orientation === "horizontal"
      ? `<rect x="${tx - (number(geometry.heightM, 4) * scale) / 2}" y="${ty - radius}" width="${number(geometry.heightM, 4) * scale}" height="${radius * 2}" rx="${radius}" fill="#bed1c9" stroke="#0d473f" stroke-width="3"/>`
      : `<circle cx="${tx}" cy="${ty}" r="${radius + 5}" fill="#d7dfda"/><circle cx="${tx}" cy="${ty}" r="${radius}" fill="#bed1c9" stroke="#0d473f" stroke-width="3"/><circle cx="${tx}" cy="${ty}" r="${Math.max(2, radius - 9)}" fill="none" stroke="#91aaa0"/><circle cx="${tx}" cy="${ty}" r="8" fill="#edf2ef" stroke="#0d473f"/>`;
  let body = `<rect x="${tx - (length * scale) / 2}" y="${ty - (width * scale) / 2}" width="${length * scale}" height="${width * scale}" rx="4" fill="#e4ebe6" stroke="#8fa79a" stroke-width="8"/>${tank}`;
  body += `<text x="${tx}" y="${ty + radius + 24}" text-anchor="middle" font-size="12">${escape(short(equipment.name || "设备资料未绑定"))}</text>`;
  if (anchors.outlet && anchors.rootValve && anchors.leak) {
    const [ox, oy] = point(anchors.outlet),
      [vx, vy] = point(anchors.rootValve),
      [lx, ly] = point(anchors.leak);
    body += `<path d="M${ox} ${oy}L${vx} ${vy}L${lx} ${ly}" stroke="#657d79" stroke-width="10" fill="none"/><circle cx="${vx}" cy="${vy}" r="9" fill="#edf2ef" stroke="#0d473f" stroke-width="3"/><path d="M${vx - 5} ${vy - 5}L${vx + 5} ${vy + 5}M${vx - 5} ${vy + 5}L${vx + 5} ${vy - 5}" stroke="#0d473f" stroke-width="2"/>`;
    body += `<path d="M${vx} ${vy - 11}L${vx} ${vy - 42}" stroke="#0d473f"/><text x="${vx}" y="${vy - 49}" text-anchor="middle" font-size="12">根部隔离阀</text>`;
    const [px, py] = point(anchors.poolCenter || anchors.leak);
    const leakLabel =
      equipment.leakAnchor === "tank-wall"
        ? "罐壁泄漏点"
        : equipment.leakAnchor === "valve-downstream"
          ? "阀后短管泄漏点"
          : "泄漏点（教学）";
    if (frame.leakVisible)
      body += `<path d="M${lx} ${ly}L${px} ${py}" fill="none" stroke="#4c96ba" stroke-width="5" stroke-dasharray="7 5"/><circle cx="${lx}" cy="${ly}" r="7" fill="#a76435" stroke="#fff" stroke-width="2"/><path d="M${lx} ${ly + 10}L${lx} ${ly + 46}" stroke="#805810"/><text x="${lx}" y="${ly + 62}" text-anchor="middle" font-size="12">${leakLabel}</text>`;
    if (frame.poolVisible) {
      const poolRadius = Math.max(
        2,
        number(spec.pool?.radiusM, 1.2) *
          scale *
          clamp(number(frame.poolScale, 1), 0.06, 1),
      );
      body += `<circle cx="${px}" cy="${py}" r="${poolRadius}" fill="#8fc4d5" opacity=".58" stroke="#528ca2" stroke-width="1.5"/>`;
      if (frame.fireVisible) {
        const time = number(frame.noiseTime),
          points = [];
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const r =
            poolRadius *
            (0.72 +
              0.08 * Math.sin(a * 5 + time) +
              0.04 * Math.cos(a * 9 - time));
          points.push(`${px + Math.cos(a) * r},${py + Math.sin(a) * r}`);
        }
        body += `<polygon points="${points.join(" ")}" fill="${style.color}" opacity="${style.opacity}" stroke="${style.color}" stroke-width="${style.mode === "assisted" ? 3 : 1}"/><circle cx="${px}" cy="${py}" r="${poolRadius * 0.34}" fill="#d8eaff" opacity="${style.opacity * 0.6}"/>`;
        body += `<path d="M${px} ${py - poolRadius - 4}L${px} ${py - poolRadius - 35}" stroke="#3d789b"/><text x="${px}" y="${py - poolRadius - 43}" text-anchor="middle" font-size="12">${escape(short(spec.material?.name, 14))}火焰位置（教学）</text>`;
      }
    }
  }
  if (Number.isFinite(equipment.liquidLevelM))
    body += `<text x="35" y="383">罐内液位约 ${equipment.liquidLevelM.toFixed(2)} m · 仅由教学几何推导</text>`;
  else
    body += '<text x="35" y="383">液位未填写 / 不能由当前库存基准推导</text>';
  for (const receptor of spec.receptors || []) {
    const [x, y] = point(receptor);
    if (x >= 25 && x <= 795 && y >= 82 && y <= 365)
      body += `<circle cx="${x}" cy="${y}" r="4" fill="#0d473f"/><text x="${x + 7}" y="${y - 5}" font-size="12">${escape(short(receptor.id, 14))} · 高 ${escape(receptor.z)} m（记录）</text>`;
  }
  return body;
}

function mechanism(spec) {
  const id = spec.sceneId;
  const vessel =
    '<rect x="75" y="158" width="125" height="140" rx="17" fill="#b4cbc0" stroke="#0d473f" stroke-width="3"/><ellipse cx="137.5" cy="158" rx="62.5" ry="18" fill="#d6e2dc" stroke="#0d473f" stroke-width="3"/><path d="M200 270H276" stroke="#657d79" stroke-width="11"/>';
  if (id === "pool-fire")
    return `${vessel}<ellipse cx="415" cy="291" rx="115" ry="27" fill="#9dcbd7" opacity=".5"/><path d="M280 270L330 290" stroke="#6699ad" stroke-width="5"/><text x="310" y="164">池火机制：液体形成液池并点燃</text><text x="310" y="197">当前条件尚不足以播放具体设备分镜</text>`;
  if (id === "jet-fire")
    return `${vessel}<path d="M275 265Q420 175 620 250L290 283Z" fill="#c9b17f" opacity=".7"/><path d="M280 271Q440 228 548 255" fill="none" stroke="#f4e6b9" stroke-width="14"/><text x="302" y="141">有压持续喷放 + 点火 → 定向火焰</text><text x="302" y="328">需核实相态、压力、释放与隔离边界</text>`;
  if (id === "flash-fire")
    return `${vessel}<ellipse cx="455" cy="250" rx="178" ry="57" fill="#c3cdd4" opacity=".55"/><path d="M312 275Q342 210 370 265Q403 194 431 260Q465 205 498 266Q530 218 568 263" fill="none" stroke="#bb9857" stroke-width="7"/><text x="300" y="145">可燃云团内的火焰传播</text><text x="300" y="334">不默认附加破坏性超压</text>`;
  if (id === "vce")
    return `${vessel}<ellipse cx="465" cy="242" rx="182" ry="77" fill="#d4c8a6" opacity=".5"/><path d="M345 302V192H370V302M420 302V176H446V302M498 302V201H524V302" fill="none" stroke="#768886" stroke-width="12"/><path d="M302 270Q344 229 399 254Q459 230 571 252" fill="none" stroke="#ba9250" stroke-width="6"/><text x="280" y="130">云团 + 点火 + 拥塞 / 受限及火焰加速条件</text><text x="300" y="342">超压未评估；不能把所有闪火都当作 VCE</text>`;
  if (id === "bleve")
    return '<rect x="153" y="186" width="224" height="103" rx="51" fill="#bed1c9" stroke="#0d473f" stroke-width="3"/><path d="M170 176L134 126M252 173L252 106M364 178L411 125M391 243L466 243" stroke="#9a7541" stroke-width="5"/><path d="M234 181L252 220L235 243L260 290" stroke="#805810" fill="none" stroke-width="4"/><text x="450" y="186">过热液体 + 容器失效</text><text x="450" y="222">快速降压与碎片</text><text x="450" y="258">可燃介质还可能形成火球</text><text x="106" y="344">受压容器机制图；不代表已改变当前物料、储存压力或设备</text>';
  if (id === "toxic")
    return `${vessel}<path d="M276 268Q390 169 701 145L701 313Q410 332 276 280" fill="#8ca9b2" opacity=".34"/><path d="M350 255H600M582 243L602 255L582 267" stroke="#557c89" stroke-width="4" fill="none"/><text x="310" y="119">进入空气 → 迁移与暴露</text><text x="320" y="342">着色非真实气体颜色；箭头非已计算风场或浓度</text>`;
  return `<text x="410" y="205" text-anchor="middle">${escape(spec.scenario?.name || "未指定事故场景")}</text><text x="410" y="242" text-anchor="middle">当前没有可显示的机制；请检查场景选择。</text>`;
}

/** Pure diagram from current inputs. An absent result never selects a pool fire. */
export function sceneSvg(spec, frame = {}) {
  const style = visualStyle(spec);
  const detailed =
    spec?.sceneId === "pool-fire" &&
    spec.support?.canPlayDetailedStoryboard === true;
  const body = detailed ? poolPlan(spec, frame, style) : mechanism(spec || {});
  const title = `${spec?.material?.name || "物料未填写"}${spec?.material?.english ? ` / ${spec.material.english}` : ""} · ${spec?.scenario?.name || spec?.sceneId || "场景未指定"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 450" role="img" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="15" fill="#36554c" aria-label="${escape(title)}，教学机制示意，无工程后果比例"><title>${escape(title)}</title><rect width="820" height="450" rx="12" fill="#edf2ef"/><text x="28" y="34" font-weight="600">${escape(short(title, 62))}</text><text x="28" y="61" font-size="13">${detailed ? "俯视教学示意 · 几何关系来自当前场景" : "独立事故机制教学 · 不改变当前设备记录"}</text><text x="754" y="36">北 ↑</text>${body}<path d="M26 401H794" stroke="#cad7d0"/><text x="28" y="422" font-size="12">${escape(style.note)}</text><text x="28" y="441" font-size="12">教学预设外观，非工程测量比例；后果距离与发生频率尚未评估</text></svg>`;
}

export function render2d(host, spec, frame) {
  host.innerHTML = sceneSvg(spec, frame);
  host.dataset.sceneId = spec?.sceneId || "unspecified";
  host.dataset.materialId = spec?.material?.id || "unconfirmed";
  host.dataset.stage = String(number(frame?.stage));
}

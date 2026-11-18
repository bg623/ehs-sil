# V0.2.0 定性来源与数据边界

核查日期：2026-11-17（Asia/Shanghai）。这里记录实际读取范围，不代表专家审核或工程模型验证。结构化引用见 `data/scenario/source-manifest.json`；物性仍为空，`screeningEnabled=false`、批准物料为空，原模型及 technicalReview 不提升。

## 已实际核查

| 来源 | 本轮读取定位 | 采用范围 |
| --- | --- | --- |
| [CDC/NIOSH Propane](https://www.cdc.gov/niosh/npg/npgd0524.html) | CAS、Physical Description、Flammable Gas | CAS 74-98-6、无色可燃气体身份；不导入密度、蒸气压或可燃限数据 |
| [CDC/NIOSH n-Heptane](https://www.cdc.gov/niosh/npg/npgd0312.html) | CAS、Physical Description | CAS 142-82-5和无色液体身份；不将目录条目升级为批准物性包 |
| [Methanol Institute 安全手册第五版](https://methanol.org/uploads/publications/methanol-safe-handling-manual-5th-edition.pdf) | §6.1.2；印刷134–135页，PDF索引143–144 | 纯甲醇弱淡蓝、日光难见、低烟尘的定性差异；不搬用热辐射数值或处置距离 |
| [NIST TN2162r1](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2162r1.pdf) | Abstract；§1 Introduction，PDF索引16页产烟倾向段 | 甲醇与正庚烷实验燃料产烟倾向有差别；不从约0.3米实验外推工业池火尺寸 |
| [HSE HFL评审指南](https://www.hse.gov.uk/comah/assets/docs/highly-flammable-liquids.pdf) | PDF索引21–22页后果列表和事件序列；24–25页Table 2 | 区分池火、喷射火、闪火、VCE与内部爆炸；事故不由名称直接成立，不转录经验阈值 |
| [HSE RR1190](https://www.hse.gov.uk/research/rrhtm/rr1190.htm) | 官方落地页摘要，2025-04-03更新 | 围护及开启构件可影响火焰发展；仅作柜体/拥塞空间的定性背景，不换算超压；未阅读全文 |
| [Three.js Data3DTexture](https://threejs.org/docs/pages/Data3DTexture.html) | 构造、三维尺寸、过滤与包装 | 实现三维纹理基础，不是燃烧CFD，不要求升级当前锁定依赖 |
| [Three.js 体积云源码](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_volume_cloud.html) | Data3DTexture、hitBox、fragment raymarch、RawShaderMaterial | 体积射线采样参考；事故密度场、深度合成与统一seek时轴另行实现；保留第三方许可 |
| [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) | Introduction、位图清理提示、load/parse | 资源生命周期参考；不把GLB材料体积误作动态烟火缓存 |

## 数据与视觉合同

- 甲醇、乙醇和正庚烷使用液体储罐；丙烷喷射火、闪火、VCE使用明确气相管线；柜内爆燃使用有真实开口的柜体。旧 `vce` 项目ID保留，视觉过程kind使用 `vapor-cloud-explosion`。
- 气相只记录质量供料边界。几何容量、液体体积、装填率、液位均返回null；不由质量推断气体体积或流率。旧不适用体积输入保留并提示，不静默改写。
- 示例20°C、400kPa绝压的管线气相是配置假设，未执行状态方程、饱和或两相校验；近常压柜内混合物的可燃性也是独立前提，不由0.5kg自动证明。
- 五类详细过程各有独立阶段。闪火没有默认压力通道；VCE/柜内爆燃的压力辅助只是0–1艺术进度，默认关闭，不含Pa、波速或半径结果。BLEVE与毒性扩散保留独立2D机制。
- `process`中的ENU锚点、喷口方向、视觉域、云团半轴、点火与开口仅用于渲染；采样是输入+seed+progress的纯函数。无真实浓度、火焰传播速度、物理时间或CFD求解。
- 普通换事故保留物料、设备、温压和库存。不匹配时提供兼容示例ID，由用户明确加载整套示例。
- quality/cutaway/pressureAux/labels/labelDetail属于显示偏好，不进入canonicalInputs、inputHash或分析修订。

## 未核查或未执行

[Blender 5.0 Fluid Cache](https://docs.blender.org/manual/en/5.0/physics/fluid/type/domain/cache.html)本轮抓取返回402；[Buncefield第二卷](https://files.cambridge.gov.uk/public/ldf/coredocs/RD-CC/RD-CC-370/volume2a.pdf)返回403。两者记录为fetch_failed，不冒充已读依据。未执行的Blender烘焙、真实手机测量、用户视觉评分或工程专家审核均不能写为通过；程序化主路线无需这些离线资产即可运行。

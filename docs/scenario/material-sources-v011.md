# 物料目录与教学外观来源 · V0.1.1

本轮读取日期：2026-11-15（北京时间）；文档于跨日至 2026-11-16 的实施期间整理。身份引用和定性外观仅供教学，工程物性批准集合仍为空，未填密度、热值、燃烧通量或其他后果输入。

| 来源 | 实际阅读定位 | 本轮用途与限制 |
| --- | --- | --- |
| [NOAA CAMEO Chemicals — METHANOL](https://cameochemicals.noaa.gov/chemical/3874) | Chemical Identifiers、General Description、Response Recommendations / Firefighting，ERG 131 (2024) | 核对甲醇名称、CAS 67-56-1、液体描述及火焰不易观察警示；不采用页面疏散距离和毒理值。 |
| [Methanol Institute, Methanol Safe Handling Manual, 5th Edition](https://methanol.org/uploads/publications/methanol-safe-handling-manual-5th-edition.pdf) | §6.1.2 Burning Behavior，印刷 pp.134–135；PDF 零基页 143–144 | 支撑甲醇淡蓝、日光难见和低烟尘教学，以及乙醇明亮而较少烟的定性对照；不导入工程参数。 |
| [CDC/NIOSH — Ethyl alcohol](https://www.cdc.gov/niosh/npg/npgd0262.html) | CAS No.、Synonyms & Trade Names、Physical Description | 核对乙醇 / Ethanol、64-17-5、液体身份。不是实际产品纯度或工程物性核查。 |
| [CDC/NIOSH — n-Heptane](https://www.cdc.gov/niosh/npg/npgd0312.html) | 同上 | 核对正庚烷 / n-Heptane、142-82-5、液体身份；不采用其数值物性。 |
| [NIST TN 2162r1](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2162r1.pdf)，[出版入口](https://www.nist.gov/publications/global-and-local-structure-medium-scale-pool-fires) | Abstract 与 §1 Introduction 的 fuel-sooting tendencies 段落 | 中等尺度实验包含甲醇、乙醇、正庚烷等；只用其燃料差异背景，不能外推本教学设备的工程尺度。 |
| [NIST Energy Balance in Medium-Scale Methanol, Ethanol, and Acetone Pool Fires](https://www.nist.gov/publications/energy-balance-medium-scale-methanol-ethanol-and-acetone-pool-fires) | 2019-07-01 出版信息与 Abstract | 进一步学习链接；未宣称阅读全文、转录测量值或验证本实现。 |

JSON 的 source-manifest 提供每条引用的 ID、标题、URL、章节、读取日期、允许用途及 supports 字段映射。来源没有在运行时远程加载；用户主动打开外部参考链接前，目录和演示仍仅使用同源静态资源。

## 如何避免把美术效果当成工程模型

颜色、透明度、扰动、教学液池半径与设备尺寸是原创建模或指南教学配置，均另列来源；不声称这些数值来自实验标定。甲醇自然外观与可见性辅助有不同常驻说明，辅助模式不作热成像。纯度不明、含水或混合物须使用通用机制或外观不确定说明。低可见性不代表没有热危险。

默认模板是 4 m 内径、4 m 直壁的虚构立式罐，库存主基准为 30 m³，20°C、常压。只从已绑定的教学圆筒几何推导示意容量和液位，不用未经审核密度补质量。另一组小型立式教学几何用于检验换设备后的容量约束；不得静默截断库存。unbound 模板只显示通用占位，不确认容量或液位。

保留 teaching-a 的原合成身份；不将旧草稿改名为甲醇。自定义物料不借用已核对目录的身份或燃烧外观。capabilities.screeningEnabled=false，approvedChemicalIds=[]，approvedScreeningMaterials=[]，productionPropertyRecords=[]；本轮没有修改或代签 model-registry 的审核与专业验证信息。

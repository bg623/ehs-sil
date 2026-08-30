# 化学品作业风险矩阵方法说明

方法版本：`CRM-2026.08-v1`  
复核日期：2026-08-30

## 审查结论

任务书采用两条不可混算的路线是正确的：路线 A 用于没有可靠检测数据时的控制分级，路线 B 用于已有符合要求检测数据时的有毒作业分级。火灾、爆炸、反应失控、腐蚀、可燃粉尘和不相容等危险始终作为独立红旗，不能与职业健康结果平均成总分。

上线实现采用以下保守边界：

- 路线 A 只自动映射 ILO International Chemical Control Toolkit 官方页面明确列出的 GHS 危害类别；未匹配分类不默认 A 组；
- H-code 只用于记录，V1 不根据未经逐条审核的 H-code 字典自动映射；
- 气体、气溶胶和工艺生成物不直接输出路线 A 的低风险结论；
- 路线 B 无 OEL 时停止 B/G 计算并转路线 A 或 GBZ/T 298；
- 采样不符合 GBZ 159 最低要求时只标为试算；
- 检测浓度与限值单位不一致时阻断计算；
- 混合物 THI 的组分临界值和 ATE 加和计算未在 V1 开放，避免把不完整组分资料拼成精确结果；
- GBZ/T 230—2025 明确要求由受过职业卫生专业训练的人员使用，页面因此始终显示专业复核边界。

## 路线 A

输入为经 SDS 核对的 GHS 健康危害分类、用量等级和挥发/扬尘等级。多个危害组命中时取 A–E 中最严格者，皮肤/眼睛组 S 可同时存在。控制方案矩阵存放在 `data/control-banding-v1.json`，输出 CA1–CA4 与计算路径。

来源：

- ILO International Chemical Control Toolkit：`https://webapps.ilo.org/static/english/protection/safework/ctrl_banding/toolkit/icct/howto.htm`
- ILO inhalation hazard groups：`https://webapps.ilo.org/static/english/protection/safework/ctrl_banding/toolkit/icct/hgroup.htm`
- ILO skin/eye group S：`https://webapps.ilo.org/static/english/protection/safework/ctrl_banding/toolkit/icct/skin.htm`
- UK HSE COSHH Essentials：`https://www.hse.gov.uk/coshh/essentials/index.htm`

## 路线 B

单一化学物分别计算可用的 `B_TWA`、`B_STEL`、`B_peak` 或 `B_MAC`，取最大值。仅有 PC-TWA 且有峰浓度时，峰浓度比值分母为 `3 × PC-TWA`。`B ≤ 0.5` 时 `WB = 0`，否则 `WB = B`；`G = WD × WB × WL`。

边界为：`G = 0` 为 0 级，`0 < G ≤ 6` 为Ⅰ级，`6 < G ≤ 24` 为Ⅱ级，`G > 24` 为Ⅲ级。`B > 1` 时不得低于Ⅱ级；致畸、致癌、致突变、致敏或可经皮吸收时提升一级，最高Ⅲ级。

来源：GBZ/T 229.2—2025、GBZ/T 230—2025、GBZ 2.1—2019 及现行修改单、GBZ/T 298—2017、GB 30000.1—2024 的官方发布或公开系统页面。

## 隐私与商业边界

草稿使用 `ehs_sil_chemical_risk_matrix_v1` 保存在当前浏览器，不上传 SDS、检测报告或企业化学品信息。前端事件只记录路线、结果枚举和功能行为。风险结论、计算路径、红旗和安全关键措施免费显示；会员门槛仅用于完整 Excel 台账能力。

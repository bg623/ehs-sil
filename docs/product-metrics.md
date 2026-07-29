# JSA Coach 产品指标

版本：V0.1  
真实数据状态：尚未开始收集

## 实施状态

- 前端隐私受限埋点：已开发；
- 自动化结构与事件检查：已通过；
- 生产数据：0；
- 真实用户反馈：0；
- 30日复访数据：尚不可用；
- 上述“0”表示实验尚未启动，不表示用户未发现遗漏或产品无效。

## 用户分组

- `toolbox_member`：现有工具箱会员；
- `public_non_member`：公众号或公开渠道非会员；
- `ehs_supervisor_manager`：EHS主管或经理；
- `junior_ehs`：初级EHS人员；
- `unknown`：尚未确认分组。

会员与非会员的购买、导出和复访数据不得混合统计。

## 核心事件

- `visit_jsa_coach`
- `start_scene_identification`
- `complete_scene_identification`
- `use_risk_prompt`
- `complete_jsa`
- `view_completeness_check`
- `print_or_export_result`
- `report_found_omission`
- `report_used_for_real_work`
- `return_within_30_days`
- `non_member_purchase`
- `member_renewal_intent`

## 北极星指标

完成 JSA 完整性检查，并将结果用于实际工作的用户数量。

该指标必须由：

1. `view_completeness_check`；
2. 用户明确反馈 `report_used_for_real_work`

共同确认，不能通过页面访问推断。

## 数据边界

- 不采集企业名称、人员姓名和完整作业内容；
- 不将示例体验计入真实工作采用指标；
- 不将自动化测试计入产品指标；
- 未经用户明确反馈，不推断其发现遗漏、用于实际工作或愿意付费。

## 技术实现

- 前端事件模块：`js/analytics.js`；
- 当前复用网站已有百度统计，不引入新的用户识别服务；
- 只发送事件名、实验分组、示例/用户模式和随机会话标识；
- 不发送表单字段、作业描述、危害、措施、企业名称、人员姓名或激活码；
- `report_found_omission`、`report_used_for_real_work`、购买、续费和30日复访必须由后续真实反馈或服务端数据确认，前端不得自动推断。

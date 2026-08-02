# JSA Coach 产品指标

版本：V0.2
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

`legacy_vip` 只用于履约统计，不计入新的工具箱会员购买转化；需要比较时必须单独列示。

会员分组的权威来源是服务端 `entitlement_source`；在生产迁移完成前，不得用页面文案、激活码标签或人工猜测替代。

## 统一漏斗事件 v1

所有页面使用统一业务语义，当前由 `js/analytics.js` 发送到既有百度统计。旧JSA调用名称在模块内部转换，不形成第二套统计口径。

- `search_submit`
- `search_no_result`
- `search_result_click`
- `tool_start`
- `tool_complete`
- `export_click`
- `vip_gate_view`
- `vip_cta_click`
- `planet_qr_click`
- `content_to_tool`

允许附带的受控字段仅包括：`event_version`、`content_id`、`tool_id`、`source_channel`、`user_tier`、`page_type`、`result_count_bucket`。不发送完整搜索词。

JSA产品诊断事件可以保留，但不得与漏斗转化混算：

- `complete_scene_identification`
- `use_risk_prompt`
- `add_jsa_step`
- `view_completeness_check`
- `view_jsa_preview`

旧调用映射：

| 旧调用 | 统一事件 |
|---|---|
| `visit_jsa_coach` | `content_to_tool` |
| `start_scene_identification` | `tool_start` |
| `complete_jsa` | `tool_complete` |
| `print_or_export_result` | `export_click` |
| `view_member_benefits` | `vip_gate_view` |
| `click_knowledge_planet` | `planet_qr_click` |

## 需要真实反馈或服务端确认的指标

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
- 当前复用网站已有百度统计，不引入新的用户识别服务；连续7天无法读取统一漏斗时延长到14天，确认不是埋点错误后再评估替换方案；
- 只发送事件名、实验分组、示例/用户模式和随机会话标识；
- 工具库和法规搜索只发送结果数量区间，不发送用户输入的原始搜索词；
- 不发送表单字段、作业描述、危害、措施、企业名称、人员姓名或激活码；
- `report_found_omission`、`report_used_for_real_work`、购买、续费和30日复访必须由后续真实反馈或服务端数据确认，前端不得自动推断。

## 入口口径

- JSA实验入口：`tools/risk-analysis.html`中的“JSA工作安全分析”卡片；
- 首页不设置JSA专属入口，因此首页访问量不得计为JSA访问；
- 工具库访问用于知识星球工具库与培训库引流，不并入JSA转化漏斗。
- 工具库条目数表示网站索引数量，不等同于知识星球已正式发布或可下载文件数量。

## 规则治理指标

- 候选规则总数；
- 产品负责人已审核规则数；
- 需要修改或拒绝的规则数；
- 具有可追溯来源的批准规则数；
- 已关联官方来源目录的候选规则数；
- 已由产品负责人确认来源适用性的规则数；
- 已接收并完成技术脱敏的真实JSA样本数；
- 待专家确认黄金案例候选数；
- 获得黄金案例覆盖的批准规则数；
- 通过完整回归测试的生产就绪规则数。

上述指标属于产品治理状态，不得计入真实用户使用、转化或北极星指标。

截至2026-08-01：

- 候选规则：11；
- 产品负责人已批准：11；
- 修改后等待复核：0；
- 已拒绝：0；
- 获得已批准黄金案例覆盖的规则：11；
- 生产就绪规则：11；
- 等待产品负责人最终上线批准的规则：0；
- 已关联官方来源目录：11；
- 产品负责人已确认来源适用性：11。
- 已接收并完成技术脱敏的真实JSA样本：5；
- 待专家确认黄金案例候选：0；
- 已批准黄金案例：20；
- 来自真实工作簿的步骤级子案例：15；
- 距离20个黄金案例最低要求：0。

## 合规识别 V1.2 数据质量口径

- 正式受控库记录数与候选库记录数分开统计；
- 候选记录不得计入“已核验法规”；
- 监测跨省地方规则泄漏、已废止版本命中、重大危险源误报、危废填埋误报、特种设备串类和自愿标准误报；
- 自动化回归通过数属于内部质量指标，不得解释为真实用户完成识别或法规适用性确认。

P1 页面只在本地计算：已选法规数、评价覆盖率、逾期整改数和即将实施数。评价覆盖率低于80%时不显示综合符合率；当前版本不计算或展示合规得分。项目导入、项目导出和 Excel 导出暂不上传业务内容。

## 合规识别 V1.3 P2 事件口径

- `example_used`：使用固定企业画像示例；
- `identification_completed`：完成一次在线识别；
- `detail_opened`：打开法规详情；
- `member_gate_viewed`：因专业导出权限不足看到会员提示；
- `knowledge_planet_clicked`：点击外企EHS工具箱入口；
- `excel_exported`：具有服务端能力的用户完成定制 Excel 导出。

事件只携带`example`或`user`模式，不携带企业名称、地区、行业、工艺、法规清单、评价记录、整改证据、激活码或用户标识。固定示例 Excel 下载不计作会员专业导出。会员与非会员转化必须按服务端`entitlement_source`分别汇总，不能把`legacy_vip`并入新工具箱购买转化。

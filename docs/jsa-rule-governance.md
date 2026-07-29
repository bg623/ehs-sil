# JSA专业规则库治理

规则文件：`data/jsa-rules.json`

## 必填字段

- `rule_id`
- `rule_name`
- `applicable_scenario`
- `trigger_condition`
- `risk_category`
- `prompt_text`
- `reason`
- `recommended_action`
- `severity`
- `source`
- `version`
- `reviewer`
- `review_date`
- `status`

## 状态

- `draft`：结构或内容尚未完成；
- `pending_review`：等待产品负责人专业审核；
- `approved`：产品负责人已审核，可进入内部测试；
- `retired`：停止使用，但保留历史；
- `rejected`：审核未通过。

## 上线门槛

生产环境只允许加载同时满足以下条件的规则：

1. `status` 为 `approved`；
2. `reviewer` 非空；
3. `review_date` 为有效日期；
4. 至少有一个黄金案例覆盖；
5. 全部回归测试通过。

当前候选规则全部标记为 `pending_review`，内容仅供产品负责人审核，不代表已上线专业结论。

## 变更控制

每次修改必须：

1. 更新规则版本；
2. 记录修改原因和反馈来源；
3. 指定或更新黄金案例；
4. 执行完整回归测试；
5. 更新发布记录；
6. 由产品负责人重新审核专业含义。

不得把规则硬编码在HTML页面或事件处理函数中。


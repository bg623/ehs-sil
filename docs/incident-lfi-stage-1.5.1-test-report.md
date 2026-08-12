# 事故与事件 / LFI：阶段1.5.1自动测试报告

日期：2026-08-12

结论：通过阶段1.5.1设计测试；阶段2A继续关闭。

> 20项项目测试通过；16个API负面场景已定义，尚未执行完整API测试。

## 本轮执行

- 命令：`node --test tests/*.test.mjs`
- 结果：20 passed，0 failed，0 skipped；
- Schema：`schema-v0.2.sql`可在临时本地SQLite中完整创建；
- 数据：测试仅使用`.invalid`邮箱、虚构租户、虚构用户和虚构资源ID；
- 环境：未创建D1/R2，未启动Miniflare，未发送邮件，未调用业务API。

## 阶段1.5.1新增验证

- 三类审计表分别存在，且更新和删除均由数据库触发器拒绝；
- 白名单外事件、字段、变更字段名及嵌套载荷在写入层被拒绝；
- 安全审计不要求或伪造`tenant_id`；
- 平台管理员无需成为租户成员即可写入平台审计；
- `accept_invite`挑战缺少`invitation_id`时由Schema拒绝；
- 同一邮箱的两个工厂邀请保持不同邀请ID、角色和挑战绑定；
- 自我授权、`tenant_admin`授予`site_leader`、最后一个有效`site_leader`被撤销等规则已形成机器可读设计断言；
- 16个跨租户/越权场景仅完成定义，`api_negative_tests_executed=false`。

本报告不构成2A-Sandbox或2A-Pilot批准。

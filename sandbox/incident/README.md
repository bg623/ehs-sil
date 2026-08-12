# Incident / LFI 2A-Sandbox

本目录是未绑定生产路由的本地验证服务，只用于租户隔离、RBAC、邀请/恢复、会话和审计安全测试。

- 运行环境：Node内置SQLite；测试使用临时本地数据库；
- API入口：`IncidentSandboxService.fetch(Request)`，不监听公网端口；
- 邮件：`MockMail`内存发件箱，只接受`.example.invalid`；
- 附件：只返回`sandbox://`模拟地址，不创建R2对象；
- 数据：仅虚构租户、人员、事故和标识；
- 禁止：生产D1/R2/KV/Queues、真实邮件、真实数据、生产路由。

合并本目录源码只代表2A-Sandbox代码完成，不代表2A-Pilot或生产部署批准。

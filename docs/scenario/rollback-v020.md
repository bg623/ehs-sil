# V0.2.0 发布与回滚操作边界

## 真实起点

2026-11-17复核生产来源为main `3be8660da8e96d855be8952c59ffe769c87c3fd8` / tree `c6ea0c8f549722d0b7a2edfe23c66d24aa1ec3b0`。当前工作台对象是404首页兜底，v0.1.1/v0.2.0模块也未上线；不是已经发布过V0.1.1的系统。不能用未发布V0.1.1作为生产回退备份。

本轮生产授权沿用。早期限定OSS页面连接失败是历史记录；当前主任务已从登录OSS页面确认杭州bucket `ehs-sil` / `oss-cn-hangzhou`，index详情ETag `5629F611188B732677680D2B830AE8C2`、43441字节、ACL继承桶、Standard、加密无。21:53双域名只读复核确认6个拟覆盖对象的bytes/SHA256/size与保留的production-before完全一致，MIME/cache无变化，原快照未改。

截至21:56:28（Asia/Shanghai），公网工具仍404首页兜底，尚未上传。RC2两项CI真实成功，但RC3池火视觉域截断修复正在验收、尚待新CI及最终包，不能把RC2候选直接当RC3上线。连接、备份复核和CI链接/时长分别见production-readiness-v020.md与ci-v020.md；不得从历史脚本或运维手册提取旧明文密钥。

## 发布前必须具备

1. 最终clean源码commit、对应远端receipt.tree和release-manifest.sourceTree一致；包内每个对象hash/MIME/size可核验，assets-manifest完整覆盖runtime，程序噪声实际262144字节及hash一致。
2. 确认实际bucket和前缀；仅操作manifest列出对象，不整桶同步。不改DNS、代理、桶权限、会员接口或收费。
3. 备份overwriteObjects实际生产字节及Content-Type、Cache-Control、ETag/Last-Modified等元数据，另记本来不存在的对象列表。共享依赖先GET核对；若与前置hash不同，停止并重新审查，不静默覆盖。
4. 保存原入口备份、发布顺序、每步结果与可用恢复通道。本地原始草稿、旧v1、v2、上一草稿以及JSON导出均不得进入公开发布包。

6份旧对象公开GET字节及响应元数据已保存在`outputs/scenario-v020-20261117/production-before/`，本次双域名metadata-only复核见`production-preflight-rc3.json`；两者不要互相覆盖。identity传输下4项补充出现的ETag不代表对象变更，字节已独立核对。恢复时保留原Cache-Control缺失的事实，不能把原来未设置的头恢复成新值。只用最终RC3新manifest/public，不从RC1/RC2候选目录增量拼包。

## 按phase发布

1. phase1：上传`dist/scenario/v0.2.0/`完整模块、Worker、数据、CSS、许可、assets-manifest；正确MIME，`public, max-age=31536000, immutable`。先核对所有对象hash，任一缺失/MIME错误就不切入口。
2. phase2：更新`tools/scenario-workbench.html`，Cache-Control=no-cache。冷缓存真实浏览器检查五类过程、自由视角与遮挡、默认甲醇、气相库存隔离、20次切换、2D失败降级、暂停seek、PNG和草稿/A迁移。
3. phase3：只更新相对真实main确有变化的首页/风险页/专题/说明脚本/工具索引等接入对象，逐项核对hash与链接；不把开发PR合并当作同步。
4. phase4：最后更新sitemap，完成公开入口及相关资源检查、记录URL→版本→manifest→sourceCommit/sourceTree。

## 触发恢复与恢复顺序

串场、旧草稿不可读取且无恢复路径、工程门控被提升、关键资源缺失、五类过程未达到验收、PNG/CSP故障或敏感网络请求应阻断/回退。上传中途失败先保持用户入口未切换；已有入口切换时先恢复引流入口，再处理工具入口，避免继续引导用户进入坏版本。

已有真实旧对象：仅恢复对应对象的备份字节及元数据，并核对public响应。原本不存在的工作台对象：不把43441字节首页兜底写成“旧工具”；可切为清晰临时维护页并保留JSON恢复指引，或恢复真实的“不存在”状态（只在已验证对象范围内、按发布记录处理）。任何删除均须精确对象，不删除目录/全站。

完整保留`dist/scenario/v0.1.0/`、`v0.1.1/`和本轮`v0.2.0/`，不清理已打开页面依赖。如果明确选择启用V0.1.1作为临时回退，应先从可追溯旧候选包上传其全部依赖、逐对象验证，再切对应HTML；这是另一个教学版本的受控发布，不是恢复未经存在的生产备份。

## 草稿与冻结A不可被回滚损坏

V0.2保持schema1.1并显式补UI偏好及confined=unknown。v1原键`ehs-sil-scenario-project-v1`保留原始字节；v2 `ehs-sil-scenario-project-v2`、上一草稿和clear标记沿用本模块，不碰其他工具数据。发现旧1.1的v2原文时，在新版persist前原字节（含冻结A）只保存一次到`ehs-sil-scenario-project-v011-original`并读回验证；已存在的合法备份永不覆写。加载和直接save调用均执行保护，配额/读回失败返回writeBlocked，保留可用内存project和原文供下载，不覆盖旧v2。clear新版键也不删除v1或V0.1.1原始备份。导入迁移不修改原文件。

**V0.1.1严格shape可能拒绝V0.2新增字段**。切回旧HTML不保证自动读取全部新版v2草稿，不能声称旧v1已同步新版修改。回滚前提示用户下载当前V0.2 JSON并保留raw；不删除新增字段、不覆盖冻结A、不清localStorage。应保留能读取V0.2草稿的恢复入口或候选预览，供导出/恢复；若确需旧版可读格式，必须单独审核无损转换和备份策略，不把丢弃字段当作迁移。

模型和registry原样，所有工程结果仍未评估。软件GPU、自动测试或逼真画面不替代物理验证、真实手机或第三方视觉评分。恢复完成也必须记录实际对象、hash和用户数据边界，不能以“页面能打开”作为唯一验收。

# 发布与回滚

授权范围：用户已要求按指南部署。公开目标为 https://ehs-sil.com/tools/scenario-workbench.html ，相关入口仅新增，不改导航层级与会员权限。

发布须使用实际阿里云 OSS 连接、确认 bucket 与前缀；只上传 release-manifest.json 的文件。版本目录先行（phase 1），逐项验 SHA-256 / JavaScript MIME，随后工具 HTML（phase 2），通过直接 URL 运行 2D/3D/Worker/导出，再更新六个既有对象（phase 3、4）。共享 CSS、外壳与图标列为 prerequisites：核验与源码哈希相符，不未经审阅覆盖。

需预先备份现有对象与元数据：index.html、tools/risk-analysis.html、topics/process-safety.html、js/tool-guidance.js、data/tools.json、sitemap.xml。备份 GET 内容、ETag、Content-Type、Cache-Control、Last-Modified 和 SHA-256；实际 OSS 头与内容不等同于 GitHub 原文件。新版本目录无需覆盖旧版本。

若此前没有新工具对象，异常时先恢复六个入口对象，工具 HTML 以清晰临时说明页替代；若工具 HTML 已存在，先保留并恢复其真实备份。恢复内容类型和缓存配置，核对公开 GET 哈希；不要删除版本化依赖，避免已打开页面失去资源。不得全桶删除、全站同步删除或清浏览器全站数据。

触发回滚：MIME/加载错误、未审模型意外开放、数据版本不一致、旧结果当作当前值、意外上传项目数据、影响现有工具或无可用 2D 降级。

当前安全访问能力不足时只交付候选与真实生产状态；不从历史工具读取 AccessKey，不要求用户在对话发送密钥。通过 OSS 官方控制台或其正常安全凭据管理恢复既有发布连接后，按本清单继续；不以变更 DNS、公开桶策略等方式绕过访问问题。

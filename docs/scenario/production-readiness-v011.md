# V0.1.1 生产发布就绪审查

只读核对：2026-11-16 04:57:54，北京时间。结论：**本地/候选开发可以继续；当前生产写入为 blocked，生产工作台验收为 not_run。** 用户已授权发布，不能将访问能力不足写成用户未授权。

## 公开站点的实际状态

根域公开页面仍由 `AliyunOSS` 返回，HTTPS GET 正常；本次没有更改 DNS、代理、证书、存储桶权限或会员 API。

| URL 对象 | HTTP | 实际内容 |
| --- | --- | --- |
| `/index.html` | 200 | EHS-SIL 首页 |
| `/tools/scenario-workbench.html` | 404 | 首页兜底正文，没有工作台版本或模块引用 |
| `/dist/scenario/v0.1.0/app.mjs` | 404 | `text/html; charset=utf-8`，不是 JavaScript |
| `/dist/scenario/v0.1.1/app.mjs` | 404 | `text/html; charset=utf-8`，不是 JavaScript |

这三个未找到对象返回与首页相同的正文 SHA-256：`06b201fe08cf8cf0ce1e9e7cd19c3446fa2726c44a6b4947d9909afa4bd8de33`。因此不能只看到首页画面就把工具路径当作上线成功。当前没有生产 manifest 可以把工作台对象映射到源码提交。

## 已有公开对象与实际源码哈希

以下六个对象均以实际公开 GET 解码字节计算 SHA-256，再与 GitHub 固定 `main=3be8660da8e96d855be8952c59ffe769c87c3fd8` 的 Contents API 字节独立比较。**六项全部相同，且全部不同于 PR #34 的 V0.1.0 候选。**

| 对象 | 字节 | 生产 SHA-256（与 main 相同） |
| --- | ---: | --- |
| `index.html` | 43441 | `06b201fe08cf8cf0ce1e9e7cd19c3446fa2726c44a6b4947d9909afa4bd8de33` |
| `tools/risk-analysis.html` | 13179 | `514dff44a006a4fd0ea3117ddcdc8aac02c64ca87152fd6d44bf05b18134f962` |
| `topics/process-safety.html` | 14889 | `fb9927176044e0a369b9fffe04e79309ab91bf97bf400f16b8ba5c8006dfa8a5` |
| `js/tool-guidance.js` | 7860 | `019f8a0c324242acf4601ba5cce42adbdaeec7bf3b554faae32610019e30e7a8` |
| `data/tools.json` | 195507 | `b5444cd174a6d42b9286c4deeb0a2e19a8062ab9b58e20edbb59db5432e3c2e8` |
| `sitemap.xml` | 10476 | `0ba0b76f1c4f294eacd3450b1c5cffdf1a0af2ae5d8f075864d76ab33b2e3d2c` |

响应元数据：六项 Server 均为 `AliyunOSS`。首页、风险页和工具说明脚本为 `Cache-Control: no-cache`；`data/tools.json` 为 `public, max-age=3600`；专题与 sitemap 本次未返回 Cache-Control。内容类型分别为 HTML、JavaScript、JSON 与 XML，符合其现有文件用途。

**打包影响：** 本轮允许清单必须相对真实生产 main 核对，不能只打包 V0.1.0→V0.1.1 的代码差异，否则会遗漏初始工作台的首页/风险页/专题/工具说明/索引/sitemap 接入。哪些既有对象本轮最终确有改动，由真实差异决定，不硬编码“六个文件”；上传前逐个读取并备份最新原字节及缓存元数据。

## 当前安全发布连接

| 检查 | 结果 | 可以证明的范围 |
| --- | --- | --- |
| `command -v ossutil aliyun` | 均未解析到可执行程序 | 当前 shell PATH 没有这两个 CLI |
| `~/.ossutilconfig` | 不存在 | 常见 OSS 配置路径无文件；没有读取任何配置内容 |
| `~/.ossutil/config` | 不存在 | 同上 |
| `~/.aliyun/config.json` | 不存在 | 常见 Aliyun CLI 配置无文件 |
| 当前仓库 `.github/workflows` | 未发现 OSS / Aliyun / bucket 上传流程 | 当前已检索工作流没有可复用的 OSS 发布入口 |
| GitHub repository Actions secrets | API `total_count=0`、名称列表为空 | 仅说明本仓库 repository-level Secrets，不推断其他账号或环境没有秘密 |
| 当前可用工具元数据 | 未发现 Aliyun/OSS 对象上传连接 | GitHub/Sites 等连接不能冒充本网站的 OSS 发布权限 |
| 历史含密钥部署脚本 | 未读、未执行 | 不把历史明文密钥当成当前安全连接 |
| 桌面发布会话补查 | 电脑已锁定；浏览器 OSS 控制台打开请求超时 | 没有取得可核对账号、目标桶和对象的有效发布会话，不推断曾登录等于当前能上传 |

这些检查没有穷尽所有 SDK、私有会话或阿里云账号权限；准确结论是**本轮没有发现可安全使用的现成 OSS 写入连接**。历史 bucket 名称 `ehs-sil` 仍需在实际认证连接中核对账号、地域与对象前缀，不能仅凭公开域名写入。

默认沙箱最初不能访问 GitHub 或本机服务；经允许的只读网络执行后，上述 GitHub/公开 GET 和本机 8785 核对均成功。沙箱连接失败没有被当作站点或预览服务失败。

## 发布前及发布后状态

| 工作 | 当前状态 |
| --- | --- |
| 真实 main、PR #34、旧本地文件树对应 | passed |
| localhost 8785 旧 V0.1.0 的初始映射 | passed；最终本地验收后已改指向 V0.1.1，原工作树保留 |
| 六个生产公开对象与 main 字节比较 | passed |
| 新 V0.1.1 UI/状态/迁移/导出/浏览器验证 | 由主任务另记，本审查不代填 |
| 3 名新手和真实手机试用 | not_run，不能由助手扮演后替代 |
| OSS 身份、目标及写入连接 | blocked，待恢复正常安全连接 |
| 上传、缓存更新与公开冷启动流程 | not_run，本审查未做任何生产写入 |
| 生产 3D / Worker / 替换 / 迁移 / 导出验收 | not_run，当前工具 URL 404，不具备执行前提 |

恢复正常安全连接后，先核对最终 sourceCommit、实际生产差异和 manifest，备份将改动对象，再按“新版本资源→公开哈希/MIME→工具 HTML→必要入口→公开冷缓存全流程”执行。旧资源不删除；旧 v1 草稿键保留；回滚需说明旧版不会自动读取 v2 的新增修改。不要为绕过连接问题改 DNS、公开权限或整桶同步删除，也无需在聊天发送明文密钥。

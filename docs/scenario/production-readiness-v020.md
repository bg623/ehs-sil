# V0.2.0 生产就绪与连接检查

首次记录：2026-11-17 20:23–20:25；本次更新：21:53–21:56（Asia/Shanghai）。本文件区分已做的只读审查和仍待执行的发布，不把本地QA或CI写成生产通过。

## 已确认生产状态

生产来源仍为GitHub main `3be8660da8e96d855be8952c59ffe769c87c3fd8`，tree为`c6ea0c8f549722d0b7a2edfe23c66d24aa1ec3b0`，与本地archive-root一致。20:25初始快照时PR34为OPEN、head `c20ef6c576a0421af66ed26210c4aa2cc71325d3`、tree `cf855da426732cbfb0ac7f900917e877f5aa75f7`；之后RC2源码更新为`52a4c027a5be1959b31d7cf7846b31233eab74ef`、tree `028da964152c7049c910bcc3ba449a2e5cb90efb`，不应再把初始head写成最新候选。RC3正在验收，最终receipt另记，仍未生产发布。

公网工作台和v0.1.1/v0.2.0模块均为HTTP404，Content-Type为text/html，响应体43441字节，SHA256 `06b201fe08cf8cf0ce1e9e7cd19c3446fa2726c44a6b4947d9909afa4bd8de33`，与200首页完全一致。404首页兜底不是可工作的事故工具，也不是旧工具备份。

20:24:36复查以下6个接入对象和5个共享依赖：全部HTTP200、MIME匹配，实际SHA均与已确认main树的本地archive-root字节相同。

| 路径 | 字节 | SHA256 | 当前Cache-Control |
| --- | ---: | --- | --- |
| index.html | 43441 | `06b201fe08cf8cf0ce1e9e7cd19c3446fa2726c44a6b4947d9909afa4bd8de33` | no-cache |
| tools/risk-analysis.html | 13179 | `514dff44a006a4fd0ea3117ddcdc8aac02c64ca87152fd6d44bf05b18134f962` | no-cache |
| topics/process-safety.html | 14889 | `fb9927176044e0a369b9fffe04e79309ab91bf97bf400f16b8ba5c8006dfa8a5` | 未设置 |
| js/tool-guidance.js | 7860 | `019f8a0c324242acf4601ba5cce42adbdaeec7bf3b554faae32610019e30e7a8` | no-cache |
| data/tools.json | 195507 | `b5444cd174a6d42b9286c4deeb0a2e19a8062ab9b58e20edbb59db5432e3c2e8` | public, max-age=3600 |
| sitemap.xml | 10476 | `0ba0b76f1c4f294eacd3450b1c5cffdf1a0af2ae5d8f075864d76ab33b2e3d2c` | 未设置 |
| css/style.css | 31762 | `8484c1926a6503c10e0059c5002fea5f359627ed76a915bbd543ed5e3b2c2e36` | public, max-age=3600 |
| css/design-system.css | 18122 | `0dd708465cce8e633ae8f9cccc41b01b7fd963aef847c4f4bf2b4c613229b509` | public, max-age=3600 |
| css/tool-guidance.css | 1352 | `30ac983b97a5bd1281a1500ee1dac6b692dc20c261df26c505b767db45ede60d` | no-cache |
| js/site-shell.js | 16986 | `bb377fef6d814ea166e4d8e6eb834722874df4a79b9ffe942071ac408df71d59` | no-cache |
| assets/ehs-sil-logo.png | 241828 | `45d33d557d0dc2658946a9e97ac28248fc98d2b47dfc561ef1ef8eaf10ac0f06` | public, max-age=3600 |

上述20:24读取是字节比对。此后已将6个拟覆盖对象的真实公开GET字节及响应元数据保存到`outputs/scenario-v020-20261117/production-before/`（不是从git重建）；旧快照保持只读。21:53:11（UTC 13:53:11.927）又将公网`https://ehs-sil.com/`与已确认bucket的默认域名`https://ehs-sil.oss-cn-hangzhou.aliyuncs.com/`逐项GET复核：6/6的SHA256和size均等于原快照、也彼此相同，原metadata和6份旧字节二次hash未变。

新证据仅含元数据，位于`outputs/scenario-v020-20261117/production-preflight-rc3.json`，原快照未覆盖。公网和默认OSS域名的MIME/cache/ETag逐项完全一致，MIME/cache相对原快照也无变化。请求明确使用Accept-Encoding: identity：原gzip响应未返回ETag的4项现在出现ETag，但内容hash未变；js/tool-guidance.js与sitemap.xml的ETag不变。

| 对象 | 当前ETag（两个域名相同） | 相对旧快照 |
| --- | --- | --- |
| index.html | `5629F611188B732677680D2B830AE8C2` | 原gzip响应无ETag；与当前登录OSS详情一致 |
| data/tools.json | `F9719D721EB61A227432BDC41547A854` | 原gzip响应无ETag |
| tools/risk-analysis.html | `749B49CCDD9FE06D2034E80E143EBBCD` | 原gzip响应无ETag |
| topics/process-safety.html | `12D324966B532F052621BAA2A15E8B05` | 原gzip响应无ETag |
| js/tool-guidance.js | `4F549BE2CD27BF054DC354471AAE5BC2` | 不变 |
| sitemap.xml | `9DEB70AE1CFA2A634459141798E73EDF` | 不变 |

这份GET复核不是每个对象ACL/加密/存储设置的完整认证导出。正式覆盖仍需保留必要对象设置，不以源码替代真实备份。21:56:28再次GET公网工作台仍为404、43441字节相同首页兜底；尚未上传RC3。

## 安全发布连接

| 检查 | 结果 |
| --- | --- |
| 本机ossutil / aliyun CLI | command -v均未找到 |
| 配置存在性 | `/Users/gobyjohn/.ossutilconfig`、`/Users/gobyjohn/.ossutil/config`、`/Users/gobyjohn/.aliyun/config.json`均不存在；只测存在性，未读内容 |
| 仓库workflow | 未发现ossutil/aliyun/独立OSS上传工作流 |
| GitHub repository Secrets元数据 | GET返回total_count=0、names=[]；未读取任何Secret值 |
| 当前工具元数据 | 未找到直连阿里云OSS上传工具；通用Sites不是现有OSS发布连接 |
| 早期限页连接（历史） | Chrome专用tab两次超时；宽泛Chrome读取被隐私保护拦截，未绕过；这是先前记录，不再是当前通道状态 |
| 当前认证OSS页面 | 主任务已登录并确认bucket `ehs-sil`、region `oss-cn-hangzhou`；index详情43441字节、ETag `5629F611188B732677680D2B830AE8C2`、Content-Type `text/html;charset=utf-8`、ACL继承桶、Standard、加密无 |

早期问题不是“电脑锁定”，而是限定页面连接未建立；现在主任务已通过当前登录页确认杭州目标桶，不能继续写“等待切页”。本次仅核验，没有上传、改设置或补充CLI凭据；不重复获取已有发布授权，不读取历史密钥/运维手册，不装插件、不改权限。后续上传需使用当前安全控制台通道，并先完成RC3验收与新的CI。

## 候选包与资产约束

`scripts/package-scenario-release.mjs`强制clean HEAD，源码读取逐文件匹配固定commit blob；远端sourceCommit不同于local HEAD时必须提供receipt的`--source-tree`且完全一致。拒绝非空out，public对象集合严格等release-manifest；基线强制main 3be/c6ea，不误用未发布V0.1.1。

新资源目录为`dist/scenario/v0.2.0/`；保留`dist/scenario/v0.1.0/`与`v0.1.1/`，不覆盖/清理旧immutable资源。assets-manifest必须逐对象覆盖runtime（自身除外），校验真实SHA256、MIME、size，包含用途/许可；模块、Worker、8数据、CSS与共享依赖还需独立前置检查。

程序噪声按`noise-data.mjs`实际生成：64³、单通道R8、262144字节，seed=2135587861，版本`xorshift32-r8-v1`，SHA256 `ccc4131c77fa2fb5d212cead9569449dab1b7311075bb68ffdec16ccf193466f`。构建使用同一纯模块，打包重新生成并核对sourceHash和数据hash。它是GPU艺术输入，不是浓度/温度，且不占用262144字节网络对象。开发快照的资产对象比对通过，正式release须在最后commit/build后重跑，不引用开发hash作最终成果。

旧V0.1.1 v2草稿新增独立原始备份键保护：原文与冻结A只存一次并读回核验，失败保持内存project可用但writeBlocked且不覆写原v2；save直接调用也受保护。独立unit检查覆盖BOM/缩进/换行原字节、冻结A、只写一次、clear保留和quota失败不覆写；正式全回归由主任务最终执行。

## 状态与尚未执行项

- read-only baseline / production hash / safe connection metadata：已完成。
- RC2源码receipt、候选包及两个远端CI：已完成，真实成功链接与时长见ci-v020.md；保留首轮失败历史。
- RC3池火视觉域截断修复：本地验收中；最终commit/receipt/manifest及新CI pending/not_run，不借用RC2成功替代。
- 6个覆盖对象真实GET字节备份、当前认证杭州桶/index详情、双域名/备份bytes及MIME/cache复核：已完成；逐对象更完整认证设置以当前控制台记录为准。
- OSS上传、最终公网五类场景/冷缓存/PNG/迁移验收：not_run，工具仍404；等待RC3验收/CI和发布材料收口后在原授权内执行，不再归因为当前无法登录OSS。
- 手机实机、第三方视觉评分、Blender烘焙、工程模型专业审核：以实际验收文档为准，未执行不得写passed。

发布顺序和恢复步骤见rollback-v020.md；GitHub提交/PR更新不是OSS生产上线。

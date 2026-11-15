# V0.1.1 实施基线与版本对应

只读核对时间：2026-11-16 04:57:54（Asia/Shanghai；证据时间戳 `2026-11-15T20:57:54.103Z`）。这是实施起点快照，最终源码与生产验收另行记录。

## 保留的实际成果

- 目标仓库：`bg623/ehs-sil`；GitHub `main` 当前为 `3be8660da8e96d855be8952c59ffe769c87c3fd8`。
- [PR #34](https://github.com/bg623/ehs-sil/pull/34) 仍为 OPEN，未合并；分支 `feature/scenario-workbench-v01-20261115`，head `2dffb7f0a2a4b4b193e09024e632ce4a8894e710`。
- 旧本地工作副本分支 `feature/scenario-workbench-v01`，HEAD `e39271ac5214cc16685c4917604fdd85f27ad8ad`。本地提交历史是原先固定上游归档建立的独立历史，不能将此 SHA 当作 GitHub 对应提交。
- 本地与 PR #34 的文件树均为 `aeba7ff3212133800d49f1dcb53f52777f341982`，内容映射一致。
- 本轮从该本地 HEAD 建立独立工作树 `ehs-sil-scenario-v011-20261115`，分支 `feature/scenario-workbench-v011`。没有重置旧工作树或以 main 重新开发。创建时工作区干净；随后出现的目录、状态、界面和测试改动属于本次实施，需保留。
- 仓库内没有发现 `AGENTS.md`；保留当前原生静态站、公共外壳与 `local` 隐私模式。`README.md` / `SITE_OPS.md` 的 OSS 和独立会员 API 边界由主任务沿用，旧备案/证书日期不视为当前结论。

## 用户体验 URL → 版本 → 资源 → manifest → 源码

| 入口 | 本次实际读取 | 资源与 manifest | 对应源码 |
| --- | --- | --- | --- |
| `http://127.0.0.1:8785/tools/scenario-workbench.html` | HTTP 200；标题“化学品事故场景与后果模拟工作台 · 教学试用版”；引用 `v0.1.0` | `dist/scenario/v0.1.0/`；旧工作副本 `release-candidate/scenario-0.1.0-rc2/release-manifest.json` | manifest `sourceCommit=2dffb7f0a2a4b4b193e09024e632ce4a8894e710` |
| `https://ehs-sil.com/tools/scenario-workbench.html` | HTTP 404；正文是首页兜底，无场景版本/模块引用 | 未找到已发布场景目录或可对应的生产 manifest | 不能映射成工作台源码；首页兜底与 main 首页一致 |
| `https://ehs-sil.com/dist/scenario/v0.1.0/app.mjs` | HTTP 404，`text/html`，正文仍为首页 | 不是可用 JavaScript 模块 | 不能证明 V0.1.0 已上传 |
| `https://ehs-sil.com/dist/scenario/v0.1.1/app.mjs` | HTTP 404，`text/html`，正文仍为首页 | 本轮新目录尚未发布 | 最终源码 SHA 待主任务候选完成后记录 |
| 新工作树预期 V0.1.1 | 当前为开发中源文件，不能用声明版本代替运行验收 | 目标 `dist/scenario/v0.1.1/`；最终 manifest 由本轮构建生成 | `feature/scenario-workbench-v011`，最终提交另记 |

旧预览 HTML SHA-256 为 `393b9adee61f92ca6878d235d5e43dcc0cf8b34e4efd2ad6875a27b09c550a14`，10691 字节；与旧工作副本 HTML 及 V0.1.0 RC2 manifest 的该对象一致。因此此前用户实际体验是本机 V0.1.0，不能从体验成功推导公开域名已上线。

生产工具 404 的响应体 SHA-256 为 `06b201fe08cf8cf0ce1e9e7cd19c3446fa2726c44a6b4947d9909afa4bd8de33`，43441 字节；与当前 `/index.html` 完全相同。其 HTTP 状态确为 404，并非一次读取到 200 后可以判成功的工作台。完整公开对象核对见 `production-readiness-v011.md`。

## 保持不变的数值基线

`js/scenario/models/pool-fire.mjs`：1679 字节，SHA-256 `80a86d1ea1b8415dfc0321100b1833aab1a1eaf999fb16513cbbd49ccbd473dc`。本轮交互与外观升级不得修改该算法来“配合”图形。

| 模型 | 原 modelVersion | 原 reviewStatus | 原 allowedUse | 原物理验证/评审 |
| --- | --- | --- | --- | --- |
| `pool-fire-teaching` | `0.1.0` | `verified` | `teaching` | `validationEvidence=[]`，`technicalReview=null` |
| `pool-fire-fixed-pool` | `0.1.0-draft` | `draft` | `teaching` | `validationEvidence=[]`，`technicalReview=null` |

原 registry 的 `dataVersion` 与兼容列表为 `scenario-data-0.1.0`。新教学目录可建立明确兼容映射；不能因 appVersion、模板或视觉升级提升模型版本的专业状态、物理验证或工程适用范围。原 capabilities 为 `teaching`、`screeningEnabled=false`、`approvedChemicalIds=[]`、`frequencyModel=false`。

## 检查结果的边界

本次只读审查通过了 URL/版本、公开字节与源码对应检查；没有代替主任务执行新版本测试。旧文档的 Node 230/230 是既有记录，新版本须重新运行。新手试用、真实手机与生产浏览器全流程的结果不得预填 passed。

生产授权已经存在；缺少的是当前安全 OSS 连接，不应反复索要同一授权。继续完成本地升级、预览、manifest 与回滚包；生产发布前须再读取真实生产对象并复核连接和目标。

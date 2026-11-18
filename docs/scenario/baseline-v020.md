# V0.2.0 实施与发布基线

只读复核：2026-11-17 20:23–20:25（Asia/Shanghai）。这是实施/发布起点快照，不是V0.2生产上线记录。

## 源码映射

| 对象 | 提交 | 文件树 | 实际状态 |
| --- | --- | --- | --- |
| GitHub main / 当前生产来源 | `3be8660da8e96d855be8952c59ffe769c87c3fd8` | `c6ea0c8f549722d0b7a2edfe23c66d24aa1ec3b0` | 本轮GitHub GET复核；生产六个入口字节一致 |
| 本地归档root | `ac3d6d5b53520133cfe7ca9fe4995a3517b15f80` | `c6ea0c8f549722d0b7a2edfe23c66d24aa1ec3b0` | 与main完整tree相同，打包差异基线 |
| PR34 / V0.1.1源码 | `c20ef6c576a0421af66ed26210c4aa2cc71325d3` | `cf855da426732cbfb0ac7f900917e877f5aa75f7` | OPEN，merged_at=null；不是生产版本 |
| V0.2开发起点本地HEAD | `6e0480a8b7ea4a0b4b91c149f617801f09e0d8f3` | `cf855da426732cbfb0ac7f900917e877f5aa75f7` | 与PR34 tree一致；本轮增量修改不能冒用此SHA |

工作树：`work/ehs-sil-scenario-v020-20261117`。保留V0.1.1工作树、其本地预览和所有未提交改动。V0.2最终本地提交、远端提交及tree映射必须由最后的receipt和release-manifest记录，不在开发中预填。

## URL → 版本目录 → manifest → 源码

| 入口 | 本轮真实响应 | 版本与来源 |
| --- | --- | --- |
| `http://127.0.0.1:8785/tools/scenario-workbench.html` | 200；appVersion=0.1.1；18484字节 | 引用`dist/scenario/v0.1.1/`；旧预览对应V0.1.1文件树，不能当作V0.2验收地址 |
| `http://127.0.0.1:8786/tools/scenario-workbench.html` | 200；appVersion=0.2.0；20309字节 | 引用`dist/scenario/v0.2.0/`；本轮开发预览，最终源码待提交/receipt；不是生产 |
| `https://ehs-sil.com/tools/scenario-workbench.html` | 404；AliyunOSS；43441字节首页兜底 | 没有可用场景版本与生产manifest；不得对应为V0.1.1或V0.2 |
| 公网`/dist/scenario/v0.1.1/app.mjs` | 404、text/html、同首页兜底 | 不是有效JavaScript，不证明V0.1.1部署过 |
| 公网`/dist/scenario/v0.2.0/app.mjs` | 404、text/html、同首页兜底 | 新版本尚未上线 |

20:23:28预览HTML SHA256：8785为`be0f4fc6def3687c10148a34d6b6b60c00f9da206158863507816b0169dc5a74`；8786开发快照为`2d4602772e0f849e32c515877e1040462c3abf58e7fda4c3d06796a683fd8b57`。开发期间继续变动，最终候选以manifest实际字节为准。

## 不提升的工程边界

`screeningEnabled=false`，批准物料为空，频率模型关闭。新增定性身份/视觉过程不增加物性；原`models/pool-fire.mjs`和`model-registry.json`保持原样。原数值算法SHA256为`80a86d1ea1b8415dfc0321100b1833aab1a1eaf999fb16513cbbd49ccbd473dc`。原registry中的`verified`是既有数学状态，不等于工程或专业评审；technicalReview仍为null。

Schema保持1.1，新增UI偏好和confined=unknown通过非破坏性导入补齐；保留v1/v2原始键与冻结A。旧版本严格shape不一定直接接受新版扩展，具体回滚数据边界见rollback-v020.md。

本轮未修改DNS、OSS权限或会员API。根站仍以实际AliyunOSS为生产来源；GitHub源码更新不能代替OSS同步和公网验收。发布连接与待执行项见production-readiness-v020.md。

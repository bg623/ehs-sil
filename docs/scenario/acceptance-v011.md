# 事故场景工作台 V0.1.1 验收记录

执行日期：2026-11-16，Asia/Shanghai。对象为 `feature/scenario-workbench-v011` 的本机候选。完整 QA 使用 `http://127.0.0.1:8786/tools/scenario-workbench.html`；验收后将用户原有的 8785 入口切换到同一份 V0.1.1 构建，并更新双击启动脚本。旧源目录与 v0.1.0 资源均保留。

## 结论与证据层级

- 场景核心 Node 测试：**35/35 passed**，其中本轮新增独立预期测试 21 项；未直接继承 V0.1 的通过声明。
- 全站本地 Node 测试：**251/251 passed**，由主任务执行；不是远端 CI 结果。
- 整页浏览器：**20/20 passed**，包含 2 项新增的数据保真回归及加强后的 ST02 真实 Worker 计数/显示偏好持久化断言。最终冻结构建已重新完整运行；机器记录为 `test-results/scenario-v011/results.json`，420次同源GET，意外错误0。
- 开发者截图视觉复核：**passed（教学画面与界面范围）**。总览标签遮挡火焰的问题已修复；增强/自然总览、完整液池近景、360/390px视图已实际看图确认。不是工程物理验证，也不是3名真实用户试用。
- 3 名首次使用者试用：**not_run**；真实手机硬件：**not_run**。任务脚本见 [novice-trial-v011.md](novice-trial-v011.md)。
- 生产上传、公开冷缓存工作台全流程、生产回滚演练：**not_run**。当前安全 OSS 写入连接状态见 [production-readiness-v011.md](production-readiness-v011.md)，不得把 localhost 通过写成已上线。

状态词：`passed` 仅表示该列明确执行的范围；`partial` 表示只有部分证据；`not_run` 表示未执行；`not_applicable` 表示该界面没有开放此工程通路。下表“人工”特指未参与开发的真实使用者/真实设备，不把开发者操作扮成用户试用；开发者截图复核另记。

环境：macOS、本机 Node 26.3.1；Playwright 1.57.0；Headless Chromium 149.0.7827.55，软件 GPU。360/390px 为桌面浏览器视口模拟，不是 iOS Safari 或 Android 实机。移动硬件帧率、弱网首屏时间、后台恢复及浏览器间兼容性未测。

## 原 AT01—AT12 本轮重新回归

| 编号与范围 | 代码 / 组件 | 本机整页浏览器 | 人工 / 真实设备 | 生产 |
| --- | --- | --- | --- | --- |
| AT01 游客与池火 3D | passed：工程量仍为 null，模板完整 | passed：游客无会员请求；真实 WebGL、真实 Worker、播放帧与拖动镜头；标签避让后的淡蓝火焰截图已复核 | not_run | not_run |
| AT02 3D 不可用 | passed：无详细 3D 时独立机制 | passed：阻断动态 3D 资源后保留 2D、换料及 JSON 导出；直接禁用 WebGL 上下文未运行 | not_run | not_run |
| AT03 未审核物质 | passed：无工程已审物料、所有工程结果 null | passed：乙醇等只改变当前条件与定性外观，导出不解锁工程值 | not_run | not_run |
| AT04 混合物 | passed：未知/混合物使用通用视觉，不能解锁模型 | partial：本轮整页主流程使用纯物料，混合物由 Node 与渲染组件覆盖 | not_run | not_run |
| AT05 非法输入 / 单位 | passed：非有限值、字符串、负值、超库存释放量拒绝；0 库存与 null 区分；K/°C、Pa/kPa | passed：20°C→293.15 K、25°C→298.15 K；110 kPa→110000 Pa；未知温压保留 null | not_run | not_run |
| AT06 过期结果 | passed：输入修订、输入 hash、旧导出拒用 | passed：换料/事故后导出当前条件和“未评估”，无旧池火模型/哈希 | not_run | not_run |
| AT07 旧异步任务 | passed：双标识拒收，撤销继续增加修订 | passed：真实 Worker 的旧修订响应延迟 2500ms 后到达，不覆盖新乙醇场景 | not_run | not_run |
| AT08 有限质量 / 稳态 | passed：独立合成数学预期、反平方、有限库存耗尽及固定面积稳态关系；算法文件 SHA-256 未改 | not_applicable：公开界面不开放工程数值通路 | not_run：不是物理模型验证 | not_run |
| AT09 SIS / 时间 | passed：措施只记录；改变动作时间不改变未评估输出 | passed：不同边界/时间/证据的 2 条措施在只改库存后完整保留；未进行真实 SIS 性能验证 | not_run | not_run |
| AT10 备份恢复 | passed：A 独立、迁移纯函数、v1 字节不改、v2 清除不复活 v1 | passed：导入、冻结 A、整套模板、上一草稿 Q 恢复；JSON/CSV/PDF；其他工具键不变 | not_run | not_run |
| AT11 恶意 / 超限 | passed：字段白名单、污染键、未来版本、超 1 MiB、NaN/Infinity、来源声明不能解锁审核 | passed：损坏/恶意/未来/超限导入不破坏当前；配额失败内存仍可导出 | not_run | not_run |
| AT12 手机 / 键盘 | passed：界面入口无会员门控 | passed：360、390px 完整播放—编辑—切换—导出；Enter 应用，无整页水平溢出 | not_run：真实手机与辅助技术未测 | not_run |

## V0.1.1 新增验收矩阵

| 编号与范围 | 代码 / 组件 | 本机整页浏览器 | 人工 / 真实设备 | 生产 |
| --- | --- | --- | --- | --- |
| UX01 首次打开 | passed：甲醇 30m³、4m×4m 储罐、20°C、常压、液池半径 1.2m 教学模板 | passed：打开即可播放；初始未写个人 v2 草稿 | not_run：15 秒目标未验证 | not_run |
| UX02 修改示例 | passed：保留完整输入而不是创建空表 | passed：导出继承的物料/设备/库存/温压/事故 | not_run | not_run |
| UX03 只换物料 | passed：预览纯函数，局部应用保留设备/库存/温压/A | passed：甲醇→乙醇保留 30m³、设备、293.15K、101325Pa | not_run | not_run |
| UX04 库存基准 | passed：mass/volume/fill 只允许一个主值；缺密度不补算；只切基准不改单位标签冒充换算 | passed：20000kg 换料后质量不变，体积/装填率为 null；60% 保存为 .6 | not_run | not_run |
| UX05 只换设备 | passed：保留输入库存，重新判断容量/液位/锚点 | passed：小罐保留 30m³并具体警示超容量，不截断；可改装填率 | not_run | not_run |
| UX06 只改工况 | passed：温压单位转换，null 与 0 分开 | passed：温度/绝压/未知值输入、应用、导出 | not_run | not_run |
| UX07 只换事故 | passed：各事故自己的规则/模型标识，不冒充池火 | passed：喷射火、闪火、VCE、BLEVE、毒性扩散保留物料与储存条件，独立 2D/标题/导出 | not_run | not_run |
| UX08 条件不足 | passed：支持级别与具体原因分离，工程计算始终关闭 | passed：超容量、BLEVE 等前提不足有说明；不宣称事故不会发生 | not_run | not_run |
| UX09 取消 / 撤销 | passed：preview 不改项目；undo 产生新修订，A 不变 | passed：取消输入/修订完全不变；撤销恢复物料但修订继续增加 | not_run | not_run |
| UX10 整套模板 | passed：模板替换保留冻结 A 和 previous | passed：整套示例替换后可恢复乙醇草稿与 A；未保存时才确认的分支未单独演练 | not_run | not_run |
| ST01 输入变化 / 异步 | passed：旧结果和旧修订拒收 | passed：延迟真实旧 Worker，最终材料/修订保持新状态 | not_run | not_run |
| ST02 显示与分析分离 | passed：UI 不进入输入 hash | passed：镜头、速度、显示模式、标签不改修订；真实 Worker.postMessage 计数不增加；显示偏好写入v2 | not_run | not_run |
| ST03 20 次连续切换 | passed：连续 apply 最后状态与 A 不串 | passed：20 次物料替换并穿插非池火，最终甲醇池火，活动时钟最多 1 | not_run | not_run |
| VI01 设备 / 泄漏锚点 | passed：锚点关系与液池在基础外、围堰内；独立组件真实换设备见视觉文档 | passed：设备、管线、根阀、泄漏点与液池可辨；标签避让及引导线不再遮住总览火焰 | not_run | not_run |
| VI02 火焰根部 | passed：组件锚定 poolCenter | passed：总览及近景淡蓝火焰附着液池；近景顶部完整，没有从整个储罐着火的错误画面 | not_run | not_run |
| VI03 甲醇特征 | passed：独立物料视觉数据，无默认浓黑烟火球 | passed：自然/辅助常驻说明正确；同镜头近景增强明显强于自然；没有改色为橙色火球 | not_run | not_run |
| VI04 暂停 / 拖动 | passed：纯确定性采样；组件固定进度恢复 PNG 字节一致 | passed：播放/暂停活动时钟 1→0，进度可拖，镜头可旋转；最终截图无重复动画/旧场景残影；未做实机长时测试 | not_run | not_run |
| VI05 非池火 | passed：场景专属机制 / 标题 / 结果标识 | passed：5 类事故均没有池火阶段或隐式 3D 回退 | not_run | not_run |
| VI06 2D / 3D 降级 | passed：两种视图接受同一 sceneSpec/frame | passed：动态资源失败仍能 2D、修改和导出；实际 GPU 上下文丢失分支 not_run | not_run | not_run |
| DA01 旧项目 | passed：纯、幂等迁移，冻结 A 独立迁移，不篡改教学液体 A 身份 | passed：v1 原始字节保留，1000kg 与 A 的750kg分别保留；备注/温压保留 | not_run | not_run |
| DA02 导入失败 | passed：损坏/超限/污染/未来版本拒绝 | passed：4 种失败后当前 inputs 深比较不变；其他工具 sentinel 不变 | not_run | not_run |
| DA03 保存失败 | passed：读回验证；错误返回可恢复项目 | passed：主动注入 QuotaExceededError，明确未保存，当前乙醇/30m³仍可导出 | not_run | not_run |
| DA04 额外回归：previous Q | passed：恢复前先捕获旧备份 | passed：刷新到默认示例，存在 v2 P 与 previous Q；点击恢复得到 Q 的完整条件，不是 P | not_run | not_run |
| DA05 额外回归：记录保真 | passed：未编辑记录不批量重写 | passed：旧项目 2 条不同措施+2条“用户补充”假设，单改库存后全部逐项不变，A 保留 | not_run | not_run |
| EX01 过期导出 | passed：当前底稿，不携旧数值/hash | passed：当前非池火 JSON/CSV/PDF，明确未评估，不带 pool-fire-teaching | not_run | not_run |
| EX02 内容一致 | passed：report/csv 均由当前项目和catalog生成 | passed：乙醇/CAS64-17-5/VCE/体积/版本一致；无当前可信结果仍可导出底稿 | not_run | not_run |
| EX03 A/B 独立 | passed：深复制 A；模型0.1.0不被app0.1.1冒充升级；数据版本不兼容能说明 | passed：B 换料和整套模板后 A 保持甲醇；恢复上一草稿仍保留 A | not_run | not_run |
| EX04 显示说明导出 | passed：使用当前视觉规则/模式 | passed：自然外观说明写入打印报告；辅助模式数据与报告在 Node 覆盖，不冒充实测 | not_run | not_run |
| GA01 能力门控 | passed：screeningEnabled=false；approvedChemicalIds=[]；technicalReview=null；全部工程量 null；数值算法 SHA 不变 | passed：仅教学/未评估，无工程影响距离 | not_run：无专业审核签字 | not_run |
| GA02 隐私 | passed：本地存储，导入不提升审核 | passed：20 组请求全部同源 GET，无项目上传、会员/分析/反馈 API；无意外页面/CSP错误 | not_run：未做第三方安全审计 | not_run |
| MB01 手机 / 键盘 | passed：可折叠参数、原生对话框 | passed：360/390px 完整任务、键盘确认、对话框应用/取消可见 | not_run：真实手机、读屏及3名用户 | not_run |
| PF01 生命周期 | passed：renderer 无独立时钟；dispose 与对象计数由独立组件实测 | passed：20 次主流程切换时几何数量有界、rendererCount=1、activeClocks≤1；非物理显存结论 | not_run：实机长时帧率/弱网 | not_run |
| RL01 发布 / 回滚 | partial：本地版本目录可构建，发布manifest与回滚由主任务交付 | partial：8786 的新版本及依赖可加载；公开冷缓存与回滚未运行 | not_run | not_run：未上传、不宣称已发布 |

## 实际浏览器检查分组

最终 `results.json` 逐项保留状态和失败信息；脚本不通过即退出非零。20 组为：

1. UX01 完整甲醇示例、无个人草稿写入、实际3D和交互。
2. UX02/03/09 继承、预览、取消、换料、撤销。
3. UX04/06 库存基准、温度与绝对压力。
4. UX05/08 设备替换、容量超限、60%装填率。
5. UX07/VI05/EX01 五种非池火机制和当前导出。
6. ST01 延迟真实 Worker 的旧响应。
7. ST02/VI03/04 只改显示偏好，不改分析修订。
8. EX03/UX10 冻结 A、整套示例与上一个草稿。
9. DA01 旧版身份、质量基准、原字节与独立 A 迁移。
10. DA04 刷新示例模式下恢复 Q，不被 P 覆盖。
11. DA05 多措施/多假设的单字段编辑保真。
12. DA02 正常恢复与四类恶意/失败导入。
13. DA03 存储配额失败与内存导出。
14. EX01/02/04 当前乙醇 VCE 的 JSON/CSV/PDF。
15. VI06 主动阻断 3D 动态资源的 2D 降级。
16. ST03/PF01 连续20次替换和资源趋势。
17. MB01 360px 完整任务与键盘。
18. MB01 390px 完整任务与键盘。
19. reduced-motion 默认静止、允许主动播放。
20. GA02 全流程网络及页面错误汇总。

本轮最初运行曾因测试没有打开折叠的“重新检查”区和选择器只读单一说明位置而失败；已修复测试交互/定位后重新完整运行，不删除或弱化功能预期。额外人工发现上一草稿恢复及多措施/多假设批量重写两个真实问题，修复后 DA04/DA05 回归均通过。

截图人工复核还发现“总览似乎没有火焰”：根因是3块高不透明度的标签纵向完全遮挡淡蓝火焰，而不是模型、GPU首帧或需要把甲醇改成橙色火焰。组件增加投影区域标签避让和引导线，保持原Shader/颜色/透明度/高度，并修正液池近景顶部取景。冻结构建后重新跑20组，实际复核 `methanol-assisted-3d.png`、`methanol-natural-3d.png`、两张 `*-pool-unlabelled.png` 及 `mobile-fire-360.png` / `mobile-fire-390.png`：火焰与根部可辨、自然模式更弱、常驻说明保留。该视觉结论来自独立看图，不以20/20功能计数替代。

## 资源与模型边界

独立渲染实测的细节和证据见 [visual-qa-v011.md](visual-qa-v011.md)：20次真实设备替换在5m³库存下执行，以避免30m³换小罐后正确降级而“没有重建”；对象创建/释放和 `renderer.info` 分别记录。`renderer.info.textures` 在 dispose 后仍可能为1；本记录**不声称 GPU 物理显存全部回收**。整页脚本的20次换料/事故不是20次真实设备重建。

构建模块 gzip 尺寸以 `dist/scenario/v0.1.1/asset-sizes.json` 为准；最终测量 app 23909字节、3D动态块142703字节、Worker4693字节、共享小块99字节，没有大型纹理包。此为模块压缩字节，不代表含HTML/CSS/数据的首屏总传输量，也不代表弱网/手机加载耗时。

工程计算、模型验证和专业审核没有因这次交互升级而变化：APP_VERSION=0.1.1、SCHEMA_VERSION=1.1.0、DATA_VERSION=scenario-data-0.1.1、MODEL_VERSION=0.1.0。`pool-fire.mjs` SHA-256 为 `80a86d1ea1b8415dfc0321100b1833aab1a1eaf999fb16513cbbd49ccbd473dc`。热辐射、超压、浓度、持续时间、事故频率与个人风险全部未评估。合成数学测试不等于真实池火验证。

## 证据与复跑

- 核心：`tests/scenario-*.test.mjs`；迁移独立样本 `tests/fixtures/scenario-v1-project.json`。
- 整页：`tests/scenario-browser.mjs`；机器结果 `test-results/scenario-v011/results.json`。
- 截图：首屏、增强/自然、换料、容量警示、非池火、比较、迁移、2D降级、360/390px；另有液池近景关标签的增强/自然截图。
- 当前导出：`final-current-project.json`、`current-result.csv`、`current-report.pdf`；另存多记录编辑前后、Q恢复和v1迁移样本。
- 证据均为虚构 QA 数据，仅保留本地，不进入生产运行包。

```sh
node --test tests/scenario-*.test.mjs
SCENARIO_BASE_URL=http://127.0.0.1:8786 SCENARIO_QA_DIR=test-results/scenario-v011 PLAYWRIGHT_EXECUTABLE_PATH='/Users/gobyjohn/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' node tests/scenario-browser.mjs
```

浏览器执行必须对准最终构建且确认 HTTP 就绪。真实用户试用、生产写入、公开冷缓存全流程和回滚演练，在获得实际证据前继续保持 `not_run`。

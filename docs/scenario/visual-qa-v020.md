# V0.2.0 体积渲染组件与开发者视觉核查

日期：2026-11-17（北京时间）。范围：本机独立组件浏览器、程序化工业场景与最终冻结渲染源码；不是第三方用户评分、真实手机性能或工程后果验证。整页发布验收由主工作流另行记录。

## 实现边界

- 主体是 WebGL2 世界空间体积光线步进：真实 64³ R8 三维噪声、局部密度/发光场、连续平流扰动、按步长累积的 Beer 吸收与发光。没有交叉面片、锥体或粒子柱充当主体。
- 池火有液池根部与分叉浮力舌形；喷射火有独立喷口方向、近端细核心、远端卷吸与末端破碎；闪火有云团内传播前沿与未燃区域；VCE 使用独立拥塞环境、燃烧前沿和可关闭压力传播示意；柜体爆燃区分内部、预设开口与外部余燃。
- 不透明场景先写入颜色与 `DepthTexture`，重建不透明世界位置后截断体积视线；随后合成体积与界面。主质量档没有正面专用火焰贴图。
- 甲醇自然外观弱可见，辅助模式明确为艺术可见性增强；不增加浓黑烟，不把显示密度称为实际浓度。正庚烷采用独立定性外观。所有形态、温度配色和时序均是视觉配置，不是求解燃烧、风场或工程温度。
- 渲染组件没有 `requestAnimationFrame`。所有 seek 使用同一个输入进度、种子与 `noiseTime`；相机与显示质量不会改写工程输入或修订号。

## 实际操作与证据

环境：macOS，Playwright 1.57.0，Headless Chromium 149.0.7827.55，Three.js 0.181.2。组件功能回归画布为 960×540、DPR 1；六张开发者近景评审图为 1280×720、DPR 1、balanced（72 步，内部体积画布约 794×446）。不能据此宣称真实手机达到 30 fps。

| 检查 | 实际结果 |
| --- | --- |
| R01 五类场景 | 开发者组件检查通过；M01/P01 共用池火基础但物料外观不同，J01/F01/E01/D01 有独立场与环境，不是同一火球换标题 |
| R02 八角绕行 | 实际采样 0、45、90、135、180、225、270、315°，仰角 23°，保存八张图；开发者画面范围未见交叉片或纸片主体。另实际采样并保存俯视 `top.png` |
| R03 精确深度终止 | 以不透明封闭几何覆盖完整密度域，开启体积与关闭体积的 canvas PNG 字节完全一致；不是只凭截图主观判断。证据 `depth-termination.json` |
| R12 暂停与拖动 | 固定镜头 0.68→0.85→0.68，前后 PNG 字节完全一致；未依赖播放过的帧数 |
| R13 连续切换 | 20 次跨五种预设切换后，最终物料/设备/场正确；相同预设的 GPU 几何计数保持有界，复杂管廊不会借用稀疏管线 |
| R14 生命周期 | 当前 renderer=1；无私有动画循环；显式合成/环境 render target=3（颜色/深度场景、体积、昼光 PMREM）。dispose 后 renderer=0、显式 target=0、geometry=0；逻辑 geometry 创建/释放 543/543、material 269/269、texture 90/90。该计数不代表驱动全部内部 FBO；Three 内部阳光阴影 map 也在 dispose 时显式释放 |
| GPU 内部缓存 | dispose 后 `renderer.info.textures` 仍报告 1；不能据此声称驱动物理显存已完全归零 |
| R16 真实高清 PNG | 当前镜头/进度实际重新渲染至 1920×1080；非 SVG 放大，非低清画布拉伸。导出后物理画布大小、相机 aspect 与镜头状态严格恢复 |
| PNG 元数据 | 冻结物料、事故、进度、种子、修订、quality、renderer、辅助状态、剖切与压力状态、labelDetail；区分原视图与导出投影 aspect。toBlob 异步期间不恢复旧 spec/frame |
| 控制台/页面 | 最终独立组件回归中错误为 0；整页 CSP、网络、草稿和异步隔离仍需独立验收 |

证据均在工作树 `test-results/volume-v020/`：`results.json`、`orbit-*.png`、`pool-near.png`、`actual-3d-1920x1080.png`、`depth-termination.json`。`final-art/` 内六张最终开发者评审图分别为 `M01-assist.png`、`P01-heptane.png`、`J01-jet-near.png`、`F01-flash-front.png`、`E01-vce.png`、`D01-inside-vent.png`，另有同条件 `M01-natural.png`。这些虚构教学条件的测试材料不属于 OSS 运行资源。

## 自有程序化资产与内存预算

1. 三维噪声：`rendering/noise-data.mjs`，`xorshift32-r8-v1`，64³、单通道 R8、固定种子 `0x7f4a7c15`，实际源字节 262144（0.25 MiB）。构建直接对实际生成字节计算哈希；不是未执行的离线烟火缓存。
2. 昼光反射环境：自有渐变天空球与暖色光面，经 PMREM 生成 768×1024 HalfFloat CubeUV，未压缩颜色存储数学估算 6291456 字节（6 MiB）。它补充 PBR 金属反射，不是第三方 HDRI，没有远程请求；生成器及临时几何/材质立即释放，输出 target 在 view.dispose 时释放。
3. 质量档：low 为 40 步/0.42 体积分辨率，balanced 为 72 步/0.62，high 为 112 步/0.85。主场景保持输出分辨率；高清导出临时使用目标像素尺寸的完整体积画布，再恢复交互尺寸。

上述字节预算不是驱动物理显存实测；render target、阴影与设备纹理另有开销。没有加载多帧 128³ 体积序列。

## 性能状态

`results.json` 的 `lastFrameMs/averageFrameMs` 是 JavaScript 提交耗时，不能倒算 GPU 帧率。

2026-11-17 20:41:22 北京时间，其他整页浏览器验收已结束并关闭，协调独占安静窗口后完成软件 GPU 测量。证据：`software-gpu-performance.json`、`perf-frame.png`。实际 renderer 字符串为 `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`；启动时明确使用 `--use-angle=swiftshader`，没有把硬件 GPU 结果当作软件结果。

| 项目 | 实测 |
| --- | --- |
| 浏览器 | Headless Chromium 149.0.7827.55 |
| 实际输出画布 / DPR | 960×540 / 1 |
| 质量 / 体积步数 / 内部体积尺寸 | balanced / 72 / 595×335 |
| 场景与镜头 | 甲醇辅助池火 / 液池近景，进度 0.55 起逐帧递增 0.003 |
| 方法 | 5 次预热；60 个 requestAnimationFrame 采样帧，每个完整渲染后调用 WebGL `gl.finish()` 等待完成；以墙钟计时 |
| 60 帧总时间 / 完成帧率 | 10392.5 ms / 5.77 fps |
| 帧间隔中位数 / p95 | 164.0 ms / 173.7 ms |

软件路径未达到 30 fps，不能标为性能目标通过。逐帧 `gl.finish()` 有额外强同步开销，是保守的完成帧吞吐观测，不等于正常交互流水线或真实硬件 GPU 帧率；也不用于推断真实手机表现。本次没有因测量较慢就暗中降低记录中的画质或画布尺寸。

### 本机 Metal 硬件路径的有界补测

2026-11-17 20:45:57 北京时间，在主整页保护分支测试结束、浏览器关闭后，另启独立临时 headless 实例，使用 `--enable-gpu --use-angle=metal`。未接触用户 Chrome/profile，未忽略 GPU blocklist，未修改系统或 GPU 安全设置。通过 `WEBGL_debug_renderer_info` 确认实际路径为 `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`，不是把 SwiftShader 换名。

| 项目 | 实测 |
| --- | --- |
| 实际输出画布 / DPR | 1920×1080 / 1 |
| 质量 / 步数 / 内部体积尺寸 | balanced / 72 / 1190×670 |
| 场景与镜头 | M01 甲醇辅助池火 / 液池近景，进度 0.55 起逐帧递增 0.003 |
| 方法 | 5 次预热；60 个 rAF 帧，各帧 `gl.finish()`；20 秒测量上限，本轮完成全部 60 帧 |
| 60 帧时间 / 完成帧率 | 715.0 ms / 83.92 fps |
| 中位数 / p95 帧间隔 | 10.4 ms / 26.4 ms |
| 错误 | 0 |

证据：`metal-hardware-performance.json`。该样本高于 30 fps，但总观察仅约 0.715 秒、仅一个场景、独立 3D 组件，不能据此宣布五场景长时间稳定 30 fps、完整 UI 吞吐或所有用户设备达标。软件 GPU 较慢的原始结果继续保留，没有被本次硬件结果替代。

## 未执行与不可推导事项

- 三名未参与开发用户的 1–5 分视觉评分：**not_run**；开发者画面范围通过不等于中位数达到 4 分。
- 真实手机硬件、跨设备/五场景的长时间稳定 30 fps：**not_run**；本机 M4 单次有界硬件样本不替代这些项。
- Blender 烘焙、OpenVDB 转换、CFD、工程物性/源项/浓度/超压/风险验证：**not_run**，没有伪造资产或验证结果。
- `screeningEnabled`、`technicalReview`、物料工程批准与工程输出 null 状态均不由本组件升级提升。

实现使用项目锁定版本的官方基础能力：[Three.js DepthTexture](https://threejs.org/docs/pages/DepthTexture.html)、[ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html)、[WebGLRenderTarget](https://threejs.org/docs/pages/WebGLRenderTarget.html)。这些 API 依据不构成火灾或爆炸工程模型审核。

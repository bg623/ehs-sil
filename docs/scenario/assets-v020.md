# V0.2.0 工业环境与液体资产记录

记录日期：2026-11-17。此清单描述实际程序化资源，不声称执行过 Blender 烘焙、工业CFD、现场材质扫描或真实手机验证。

## 来源与许可

本轮工业几何、表面图和液流均由仓库内JavaScript确定性生成，无外部模型、HDRI、图片下载或跨域纹理。项目原创生成代码由EHS-SIL维护，不借用第三方工业资产；底层Three.js 0.181.2为MIT，随不可变运行目录保留 `THIRD_PARTY_NOTICES.txt`。未新增需要购买或单独授权的美术素材。

| assetId / version | 实际生成来源 | 域、轴、通道 | 适用范围 |
| --- | --- | --- | --- |
| industrial-environment / 0.2.0 | `js/scenario/three/scene-components.mjs` | ENU位置→Three.js `[x,z,-y]`；静态网格、PBR材质 | 罐区、一般气相管线撬块、拥塞管廊、设备柜；尺寸随已定义视觉设备条件，不代表设计合规 |
| industrial-pbr-surfaces / 0.2.0 | `js/scenario/materials/industrial-palette.mjs` | 64×64 RGBA8；金属粗糙度、混凝土粗糙度、微法线、接触阴影alpha | 自然昼光工业表面；颜色/金属度/粗糙度均为美术设置，不是批准物性 |
| liquid-release-and-wet-front / 0.2.0 | `js/scenario/effects/liquid-release.mjs` | 曲线Tube、22个instanced飞沫、平面湿润掩膜、64×64微法线 | 液体预设；锚点、飞沫、铺展和供料终止为可寻址分镜，不是源项/浅水流计算 |
| authored-procedural-daylight-pmrem / 0.2.0 | `js/scenario/rendering/volume-environment.mjs` | 自有渐变天空球与暖色光面→PMREM；实测768×1024 HalfFloat，基础估算6MiB | 为PBR金属提供昼光反射，不是外部HDRI或现场光照测量；拥有独立RT并在view.dispose释放 |
| procedural-volumes / 0.2.0 | `js/scenario/rendering/`及对应effects | 三维密度/发光场及raymarch，由渲染模块资产manifest另列 | 主火焰不再包含旧交叉面片；体积渲染验证见渲染QA记录 |

每个发布文件的实际SHA-256、字节数、MIME、资源路径由最终构建 `assets-manifest.json` 生成，不在本文预填未冻结文件的hash。程序化纹理没有独立网络对象，其内容由上述源代码和固定种子确定；不应把它们列成已下载的PNG/GLB资产。

## 可复现参数与资源预算

表面随机函数固定为 `fract(sin(x*127.1+y*311.7+17.19)*43758.5453)`；64²每纹理RGBA8基础缓冲为16384字节。金属、法线、混凝土、接触阴影共4张：65536字节基础数据；液体场景另加1张微法线，合计81920字节。部分纹理开启mipmap，GPU实际内存还包含mipmap、实现对齐和驱动缓存，不能把基础数据字节当实测显存。

液流沿当前 `process.liquid.outlet→groundImpact` 的连续重力弯曲预设曲线，湿面由落点逐渐过渡到配置的poolCenter；前沿有轻微确定性不规则边缘，裁掉基础和围堰外区域。湿面为中性无色反光表现；辅助模式增加细边界/对比，不是甲醇真实蓝色。空中液柱的 `releaseFront/liquidTail` 与地面 `poolRetention` 分开，供料结束液柱退去后湿面仍保留。所有扰动来自帧的noiseTime；暂停/跳转不依赖已经运行多少帧。

材料没有每帧创建，Tube/飞沫/湿面几何在设备assembly构建时一次创建；更新仅修改uniform、现有缓冲、instance matrix和变换。没有私有RAF。所有创建的geometry/material/texture均有dispose，lifecycle纹理钩子兼容未提供的旧调用。

## 独立场景关系

- 储罐：不透明金属罐壁、固定顶/焊缝、加强圈、梯子、顶护栏、螺栓人孔、管嘴、法兰、根阀、混凝土基础/围堰/排液。外置液位条仅表示已知体积基准的库存，不把罐壁改透明来穿透显示内部火焰。
- 一般管线：气相喷口、根阀和撬块，少量支撑/上方管线；不是储罐场景换标题。
- 拥塞管廊：5排钢框、8根管线、支撑斜杆和局部设备，位于云团场景；其数量不换算超压。
- 受限柜体：不透明前/后/侧墙、屋顶、内部柜和支架。前壁按opening中心/宽高拆为4块，保留真实开口；预设门板绕开口顶部转动。剖切隐藏前壁/屋顶/门板，保留原位置ghost边线，其余墙仍写深度；不会把整个空间改成可穿透的半透明盒。开口朝ENU `(0,-1,0)`，与ventFire锚点相同。

接触阴影由程序化软影decal和渲染器方向光PCF阴影配合；不是经过现场扫描/光照烘焙的AO。材质、液面反光和火光都是视觉效果，不输出热辐射或物性数据。

## 实际执行与未执行

组件CPU检查已实际覆盖7个可用预设（3个池火物料+喷射火/闪火/VCE/受限空间）：40次确定性seek后geometry/material/texture创建量不增加；p1供料液柱结束但湿面保留；.7→.9→.7飞沫/前沿缓冲hash一致；剖切原墙ghost存在；dispose数量与创建数量相等。最终冻结源码再次核查：罐区37几何/17材质/5纹理，柜体26几何/12材质/4纹理，全部释放对称。证据在任务根 `outputs/scenario-v020-20261117/components-qa/results.json`，长期回归为 `tests/scenario-v020-components.test.mjs` 3/3通过。这是CPU对象/资源与纯采样结果，**不代替WebGL画质或物理验证**。

最终构建整页已实际执行：旧功能回归20/20、新V0.2端到端12/12；共651次同源GET，意外页面/控制台/CSP错误0。五类真实应用播放由Playwright recordVideo记录，不是截图拼接；VP8、1440×1000，媒体时长13.12—13.64秒，实际以2x教学播放速度推进完整分镜，证据为 `test-results/scenario-v020/*-actual-playback.webm` 与 `videos-verified.json`。真实PNG重渲染的1920×1080及2048×1152文件和元数据已验证，并确认显示操作不增加分析Worker任务、不改输入修订。

20次整场景替换时，同一甲醇场景第0/6/12/18次回到当前状态的 `renderer.info` 均为38几何、12纹理，rendererCount=1、renderTargets=3；不是从canvas数量推断资源回收。最终浏览器截图已看图确认不透明罐壁/金属反射、设备与液体锚点、柜体真实开口/剖切边线和高清PNG中的当前场景标识。独立深度/8角/销毁结果引用渲染QA；renderer.dispose后可能仍报告1个内部缓存纹理，不声称所有物理显存已归零。

未执行：Blender源工程/烘焙/OpenVDB转换、照片扫描材质、真实手机性能、3名外部用户视觉评分、工程模型验证。上述项目继续为 `not_run`，不伪造资产缓存或用户认可。Headless软件GPU的有效录屏与截图不证明真实设备达到30fps，也不能代替用户画质评分。

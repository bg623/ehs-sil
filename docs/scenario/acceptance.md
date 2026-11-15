# V0.1 验收 · 2026-11-15

本地实际执行：npm ci（锁定依赖）、build、数据验证、全部 Node 测试 230/230、敏感扫描 PASS（353 个文本文件时），浏览器验收 9 组通过。最终新增文档后的敏感扫描结果以执行输出为准。

环境：macOS 本机，Node 26.3.1；Playwright 1.57.0，通过显式 executablePath 使用已安装的 Chromium 1228。Headless Chromium / 软件渲染；CI 设置 Node 24。这里不把本机结果写成 CI 已运行结果。

| 情景 | 代码 / 界面验证 | 模型 / 数据技术状态 | 生产验证 |
| --- | --- | --- | --- |
| AT01 游客与池火三维 | passed：真实 Worker 返回、实际几何、帧更新、镜头拖动截图不同、阶段切换 | 教学，无项目数值 | not_run，未上传 |
| AT02 3D 不可用 | passed：主动阻断动态 3D chunk，2D / 导出保留；实际禁用 WebGL 的独立浏览器场景 not_run | 不改变定性结果 | not_run |
| AT03 未审核物质 | passed：保存资料，所有工程量 null | 无已审生产物性 | not_run |
| AT04 混合物 | passed：界面仍教学、模型门控阻断 | 无混合物数值模型 | not_run |
| AT05 非法输入 | passed：负值界面报错；单元核查非有限值、字符串、质量上下限和单位 | 数学组件合成测试通过 | not_run |
| AT06 过期结果 | passed：修订变化标过期；单元核查导出不会带入旧哈希或数值 | 不作工程有效性结论 | not_run |
| AT07 旧异步任务 | passed：单元核查双标识拒收；真实 Worker 浏览器往返通过；人为延迟乱序浏览器情景 not_run | 仅教学任务 | not_run |
| AT08 有限质量与稳态 | passed：独立合成值，减少质量只缩短质量收支时长、点源辐射不变 | 不是物理池火验证 | not_run |
| AT09 SIS / 时间 | passed：浏览器与单元测试；措施只记录，不出现无依据数值改善 | recorded_only | not_run |
| AT10 备份恢复 | passed：冻结完整 A、JSON/CSV/PDF 文件、清除/恢复后其他工具键保留 | 导入不继承可信结果 | not_run |
| AT11 恶意 / 超限 | passed：污染键、损坏 JSON、大小、版本、字段、受限存储；浏览器拒绝恶意/超限并保留草稿 | 导入声明不能解锁模型 | not_run |
| AT12 手机与键盘 | passed：360 / 390px 无横向整页滚动，键盘焦点可操作；参数区手机折叠 | 视图无工程比例 | not_run，真实手机硬件未测 |

隐私：加载、编辑、检查、比较、保存、导出期间请求仅同源 GET；没有表单上传、会员会话、统计与反馈 API 请求。意图阻断 3D chunk 的预期 ERR_FAILED 单独排除；正常流程无页面或 CSP 错误。

资源：20 次 2D/3D 切换后旧 canvas 被移除，原 geometry/material/controls/ResizeObserver 释放。GPU 显存长期趋势、真实移动设备性能和 30fps 硬件预算 not_run，不从 canvas 数量推断 GPU 全部回收。隐藏页停止动画，默认不自动播放，点击播放才启动。

性能构建测量：初始 app 32,070 B / gzip 11,315 B；动态 3D 529,761 B / gzip 136,690 B；Worker 4,938 B / gzip 2,382 B。均在初始 250 KB / 3D 1.5 MB 预算内；不等于弱网真实用户时间。

QA 在不发布目录 test-results/scenario：desktop-2d.png、pool-fire-3d.png、comparison.png、mobile-360.png、mobile-390.png、fallback-2d.png、project.json、result.csv、report.pdf、results.json。仅虚构 QA 记录，不进入 OSS 公开包。

生产读取：11 个现有对象（六个将改动对象、五个共享前置资源）GET 均 200，与 3be8660 基线完全一致，已保存原字节及响应元数据。新工具 URL 发布前为 404。根域 DNS A 为 118.178.60.108，HTTPS GET 证书验证成功；一次 HEAD 403 与实际 GET 200 不同，不能据此判定网站整体故障。

源码完成、测试完成、模型状态和生产发布分别记录；生产上传尚未执行，不能填 passed。当前没有可用安全 OSS 发布连接，未读取历史密钥。需使用正常平台连接后完成逐对象上传与公开冷缓存 3D / Worker / 导出验收。

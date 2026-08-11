# EHS-SIL 网站 UI 阶段 1 完成报告

- 日期：2026-08-11
- 阶段：建立设计系统与公共组件
- 发布基线：`43553e2`
- 设计系统提交：`deba76b`

## 1. 完成结论

阶段 1 的代码、组件、响应式、键盘操作、Chromium 与 Safari / WebKit 兼容性以及关键业务回归均已完成。阶段内没有修改会员鉴权、JSA 规则与生成逻辑、法规匹配、Excel 权益、本地存储或 Worker 数据。

本轮收尾额外发现并修复两项公共界面问题：

1. 首页 `main.js` 未带阶段 1 缓存版本号时，已有访问者可能同时运行旧、新两套导航事件，导致移动菜单点击后立即关闭；
2. Safari / iOS 在关键页面缺少触摸图标声明时会请求不存在的默认图标。

## 2. 公共组件清单

| 组件 | 实现位置 | 结果 |
| --- | --- | --- |
| 颜色、字体、间距、圆角、阴影、容器、动效变量 | `css/design-system.css` | 通过 |
| 按钮 | `.btn`、`.ds-btn` | 通过 |
| Badge 与免费 / 会员状态标签 | `.ds-badge`、`.ds-badge-free`、`.ds-badge-member` | 通过 |
| 卡片 | `.ds-card` | 通过 |
| Header | `.site-header`、`[data-site-shell-header]` | 通过 |
| Footer | `.site-footer`、`[data-site-shell-footer]` | 通过 |
| 二级页面公共壳层 | `js/site-shell.js` | 通过 |

详细使用说明见 `docs/design-system.md`。

## 3. 采用范围

- 首页 `index.html`；
- 工具资料索引 `tools/index.html`；
- JSA 专业教练 `tools/jsa-tool.html`；
- 企业适用法规识别 `tools/compliance-identification.html`；
- 会员登录 / 激活 `dashboard/register.html`；
- 使用 `css/product.css` 的产品页面。

其他历史工具没有在本阶段大规模重构，仅通过兼容变量继续工作。

## 4. 自动测试

命令：

```bash
node --test tests/*.test.mjs
git diff --check
```

结果：

- 18 项测试通过，0 项失败；
- 49 个 HTML 页面、315 条站内引用，0 条断链；
- 颜色角色与 WCAG 对比度检查通过；
- 20 个 JSA 黄金案例回归通过；
- JSA 与法规 Excel 导出回归通过；
- 设计变量、公共组件、缓存版本和触摸图标声明检查通过；
- 未新增第三方 UI 或运行时依赖。

## 5. 响应式与交互验收

以下五个关键页面均在 360×800、390×844、768×1024、1024×768、1440×900 下完成 Chromium 检查：

- 页面级横向溢出：0；
- Header：存在；
- H1：每页 1 个；
- 页面标题：存在；
- 手机端主要按钮和导航点击区：不低于 44px。

移动导航复测：

- 触摸 / 点击展开菜单：通过；
- 方向键向下进入第一个下拉链接：通过；
- 第一次 Escape 关闭下拉并恢复焦点：通过；
- 第二次 Escape 关闭移动菜单并将焦点恢复到菜单按钮：通过；
- 旧版首页脚本缓存共存场景：已通过 `main.js?v=2.0.0` 修复。

## 6. 浏览器兼容性

| 浏览器 | 范围 | 结果 |
| --- | --- | --- |
| Chromium | 五页 × 五种视口、导航与业务冒烟 | 通过 |
| Safari / WebKit | 首页、工具索引、JSA、法规识别、会员激活的页面标题、H1、主要内容和表单结构 | 通过 |

Safari 测试发现的默认触摸图标请求已通过显式 `apple-touch-icon` 声明修复。

## 7. 关键功能回归

- 工具库搜索 `JSA`：返回 5 / 535 条；
- JSA 示例：可生成 12 个建议步骤；
- 法规识别：结果区和会员 Excel 导出入口存在；
- 会员激活：激活码输入和按钮正常显示；
- 静态本地服务器上的 `/api/vip/session` 返回 404 属于预期，因为 Worker API 不由静态预览服务器提供；生产 Worker 与会员数据未在本阶段修改。

## 8. 截图材料

截图目录：

`/Users/gobyjohn/Documents/Codex/2026-07-26/ehs-sil-chatgpt-continuity/outputs/stage-1-design-system-2026-08-11/`

包含：

- `home-desktop.jpg`；
- `home-mobile.jpg`；
- `tools-mobile.jpg`；
- `jsa-mobile.jpg`；
- `compliance-mobile.jpg`；
- `membership-mobile.jpg`。

## 9. Lighthouse 与线上访客入口

本执行环境没有可用的 Lighthouse CLI，且发布后本机公网 DNS 解析持续失败，无法从本机对 `https://ehs-sil.com/` 重新执行 Lighthouse 或五页 HTTP 访问。未虚构 Performance、Accessibility、Best Practices、SEO、LCP 或 CLS 分数。

已经完成的发布核验：

- GitHub 远程 `main` 已包含阶段 1 设计系统提交；
- GitHub 内容接口确认 `main/index.html` 引用了 `v=2.0.0` 设计资源；
- `CNAME` 仍为 `ehs-sil.com`；
- 本地 Chromium 与 Safari / WebKit 验收均通过。

网络恢复后应补做一次生产 URL 的 PageSpeed Insights / Lighthouse 记录。该测量缺口不改变阶段 1 的代码和业务回归结论，但在获得真实分数前不得宣称已达到 90 分或 Core Web Vitals 目标。

## 10. 影响与风险

- SEO：未改变首页定位、正文或 canonical；仅增加图标声明和静态资源缓存版本；
- 统计：百度统计和现有行为埋点未修改；
- 鉴权：未修改；
- 本地存储：未修改；
- 数据与 Worker：未修改；
- 密钥与凭据：没有新增、迁移或输出；
- 主要风险：缓存版本变更会使浏览器重新下载一次 `main.js`，文件体积小，影响可忽略。

## 11. 回滚

阶段 1 完整回滚基线为 `43553e2`。如线上出现公共样式或导航回归，优先使用 Git revert 生成可追踪的回滚提交，不重写 `main` 历史。

## 12. 下一步

阶段 1 发布后进入 14 天观察期。未获得用户确认与观察结论前，不启动阶段 2 首页重构。

# EHS-SIL 设计系统与公共组件

版本：Stage 1 / 2026-08-11

## 设计方向

EHS-SIL 使用“Industrial Precision（工业精准）”方向：克制、专业、可信，强调个人 EHS 工作台，而不是企业管理大屏。风险红和警示黄只表达真实状态，不作为大面积品牌装饰。

## 集中变量

所有公共变量位于 `css/design-system.css`：

- 品牌与语义颜色：`--color-*`；
- 字体层级：`--font-size-*`、`--line-height-*`；
- 8px 间距：`--space-*`，保留 4px 半步；
- 圆角：`--radius-*`；
- 阴影：`--shadow-*`；
- 页面宽度：`--container-max`；
- 动效：`--transition-*`。

旧页面的 `--primary`、`--bg`、`--text`、`--c-navy` 等变量通过兼容别名映射到新变量。迁移过程中不得再新增新的硬编码品牌色。

## 公共组件

| 组件 | 类名 / 入口 | 用途 |
| --- | --- | --- |
| 页面容器 | `.container` / `.ds-container` | 最大宽度 1200px，响应式左右留白 |
| 按钮 | `.btn` / `.ds-btn` | 最小触摸高度 44px，主、次、强调、危险状态 |
| 标签 | `.ds-badge` | 状态、免费、会员和信息标签 |
| 卡片 | `.ds-card` | 浅边框、轻阴影的内容分层 |
| Header | `.site-header` / `[data-site-shell-header]` | 桌面下拉与移动折叠菜单 |
| Footer | `[data-site-shell-footer]` | 二级页面紧凑页脚 |

二级页面通过 `js/site-shell.js` 渲染公共 Header / Footer。`data-prefix` 用于指定相对路径，`data-mode="dark"` 用于深色页面头部。脚本只管理导航交互，不读取或修改会员、JSA、法规识别和本地项目数据。

## 可访问性规则

- 正文默认 16px；
- 手机端按钮和导航点击区不低于 44px；
- 键盘焦点始终可见；
- 下拉菜单支持触摸、Tab、方向键向下进入和 Escape 关闭；
- 支持 `prefers-reduced-motion`；
- 文本使用可达到 WCAG AA 的深色角色，金色品牌色仅用于边框和装饰，正文使用 `--color-accent-text`。

## 当前采用范围

- 首页；
- 工具与培训资料索引；
- JSA 专业教练；
- 企业适用法规识别；
- 会员登录 / 激活；
- 使用 `css/product.css` 的产品页面。

其他历史工具保留兼容变量，后续按页面逐步迁移。本阶段不改会员鉴权、工具计算、法规匹配、本地存储或 Excel 导出逻辑。

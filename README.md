# EHS-SIL · 外企EHS工具与成长工作台

帮助个人EHS从业者选择正确方法、使用专业工具并形成可用于实际工作的成果。

## 网站结构

- `index.html` — 首页
- `products/toolbox.html` — 外企EHS工具箱 产品页
- `products/training.html` — 外企EHS培训库 产品页
- `tools/index.html` — 536条资料索引（不代表已发布或可下载数量，以正式发布目录为准）
- `tools/content-repurposer.html` — 内容分发助手（内部工具）
- `dashboard/index.html` — 副业数据仪表盘（内部工具）

## 更新方式

先在独立分支修改、测试和审阅。GitHub 是源码，不等于线上已更新；生产主站通过阿里云 OSS 发布，必须另获发布授权并完成对象同步、公开路径与哈希验收。会员与反馈使用独立 Worker API。具体操作以 `SITE_OPS.md` 为准；历史备案/证书日期需要实时复核。

## 本地清理

运行 `python3 cleanup_local_files.py` 可清理本地文件中的敏感信息。

## 技术栈

原生静态 HTML/CSS/JS；主站在阿里云 OSS，会员与反馈 API 位于独立子域，不因主站源码更新而自动部署。

## 本地验收

`node --test tests/*.test.mjs`、`node scripts/scan-sensitive-data.mjs`。
本轮增量说明见 `docs/system-review-20261006.md`。不需要构建主站；浏览器验收与私有 Worker 本地测试不能代替生产 Cookie、持久化或真实微信环境验收。

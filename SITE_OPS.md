# EHS-SIL 网站运维手册

> 最后更新：2026-07-22
> 网站：https://ehs-sil.com

---

## 一、架构概览

```
用户 → https://ehs-sil.com
        ↓  DNS / 路由 (Cloudflare)
   ┌────公开内容────→ GitHub Pages
   └────VIP 路径────→ Cloudflare Worker + D1 + 私有资产
```

**核心：** 公开内容保留在 GitHub Pages；VIP 验证和 VIP 工具源码由
Cloudflare Worker 服务端保护，激活码仅以哈希形式存储在 D1。

---

## 二、DNS 配置

| 项目 | 值 |
|---|---|
| 域名注册 | 阿里云 |
| DNS 服务器 | `laura.ns.cloudflare.com` / `lennon.ns.cloudflare.com` |
| Cloudflare API Token | 通过 Cloudflare Secret 管理，不写入仓库 |

**Cloudflare DNS 记录：**
| 类型 | 名称 | 值 | 代理 |
|---|---|---|---|
| A | @ | 185.199.108.153 | 🔶 开启 |
| A | @ | 185.199.109.153 | 🔶 开启 |
| A | @ | 185.199.110.153 | 🔶 开启 |
| A | @ | 185.199.111.153 | 🔶 开启 |
| CNAME | www | bg623.github.io | 🔶 开启 |

---

## 三、网站部署

**更新流程：**
1. 告诉我需要改什么
2. 我修改代码（本地）
3. 通过 GitHub API 部署到 GitHub Pages
4. Cloudflare 缓存 1-5 分钟后生效

**本地路径：**
```
/Users/gobyjohn/Documents/Codex/2026-06-20/ni-s/outputs/ehs-sil-website/
```

**关键文件：**
| 文件 | 说明 |
|---|---|
| `index.html` | 首页 |
| `css/style.css` | 样式表 |
| `js/auth.js` | VIP 服务端验证客户端，不包含激活码 |
| `js/main.js` | 主脚本（已内联到 HTML） |
| `js/tools.js` | 工具库脚本（已内联到 HTML） |
| `dashboard/register.html` | VIP 激活/购买页面 |
| `dashboard/admin-codes.html` | 已停用的旧管理入口 |
| `tools/` | 所有在线工具 |
| `data/regulations.json` | 法规数据库 |
| `data/tools.json` | 工具数据库 |
| `assets/wechat-pay-qr.jpg` | 微信收款码 |
| `CNAME` | 自定义域名 `ehs-sil.com` |
| `.nojekyll` | 禁用 Jekyll（GitHub Pages 需要） |
| `sitemap.xml` | SEO 站点地图 |
| `robots.txt` | 爬虫规则 |

---

## 四、VIP 系统

**激活码管理：**
1. 客服手机打开 `ehs-sil.com/dashboard/admin-codes.html`
2. 输入密码：`ehs-sil-admin`
3. 点击「获取新激活码」→ 复制发给用户

**码库：** 激活码仅以哈希形式存储在服务端 D1 数据库
**管理：** 由受保护的服务端接口生成、吊销和查询
**浏览器：** 仅接收 HttpOnly 会话 Cookie，不接收激活码库


---

## 五、已知问题

| 问题 | 说明 | 状态 |
|---|---|---|
| Pages 部署缓存 | GitHub Pages 构建成功但部署可能滞后 | ⚠️ 需注意 |
| JS 文件 404 | Pages 偶发不发布 JS 文件（已内联绕过） | ✅ 已修复 |
| register.html 404 | 新页面需等 Pages 更新后出现 | ⏳ 等待中 |

---

## 六、SEO 现状

| 项目 | 状态 |
|---|---|
| sitemap.xml | ✅ 已配置 |
| robots.txt | ✅ 已配置 |
| 百度统计 | ✅ 已接入（ID: 77c75d1a7737386055212c64df8ff967） |
| 百度站长验证 | ❌ 未提交 |
| 百度自动推送 | ❌ 未添加 |

---

## 七、凭据管理

- 所有 GitHub、Cloudflare、域名和后台凭据必须存放在对应平台的 Secret 管理中。
- 不得在仓库、运维文档、HTML、JavaScript、聊天记录或截图中保存明文凭据。
- 历史凭据视为已暴露，必须轮换；轮换后不得把新值补回本文档。

---

## 八、内容更新注意事项

**1. 添加新法规：** 修改 `data/regulations.json`
**2. 添加新工具：** 修改 `data/tools.json`
**3. 添加新在线工具：** 在 `tools/` 下创建新 HTML，使用 auth.js 的 VIP 门控
**4. 修改收款码：** 替换 `assets/wechat-pay-qr.jpg`
**5. 补充激活码：** 通过受保护的 Worker 管理接口创建

**重要：** 公开内容部署到 GitHub Pages；VIP 代码部署到私有 Worker。
两部分必须按“先 Worker、后 Pages”的顺序发布，避免保护路由暂时失效。

---

## 九、本地代码结构

```
ehs-sil-website/
├── index.html          # 首页（JS已内联）
├── css/
│   └── style.css       # 样式表
├── js/                 # JS文件（已内联到HTML，此目录可删除）
├── assets/
│   ├── ehs-sil-logo.png
│   └── wechat-pay-qr.jpg
├── dashboard/
│   ├── register.html   # VIP激活/购买
│   ├── admin-codes.html # 激活码管理（密码: ehs-sil-admin）
│   └── admin.html      # 工作台
├── tools/
│   ├── index.html      # 工具库搜索
│   ├── bbs-tool.html   # BBS行为安全观察
│   ├── jsa-tool.html   # JSA工作安全分析
│   ├── fmea-tool.html  # FMEA失效模式分析
│   ├── what-if-tool.html # What-If假设分析
│   ├── apollo-rca-tool.html # Apollo RCA根源分析
│   ├── tripod-beta-tool.html # Tripod Beta事故分析
│   ├── risk-analysis.html # 风险分析页面
│   ├── regulations.html # 法规速查
├── data/
│   ├── regulations.json # 法规数据库（189条）
│   └── tools.json      # 工具库（535个）
├── products/           # 产品介绍页
├── CNAME              # 自定义域名
├── .nojekyll          # 禁用Jekyll
├── sitemap.xml        # SEO站点地图
├── robots.txt         # 爬虫规则
└── SITE_OPS.md        # 本手册
```

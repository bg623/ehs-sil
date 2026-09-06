# EHS-SIL 网站运维手册

> 最后更新：2026-09-06
> 网站：https://ehs-sil.com

---

## 一、架构概览

```
用户 → https://ehs-sil.com / https://www.ehs-sil.com
        ↓  Cloudflare 权威 DNS（根域名保持 DNS-only）
        阿里云杭州 OSS 静态网站

浏览器 → https://vip-api.ehs-sil.com
          ↓ Cloudflare Worker Custom Domain
          会员会话、反馈接口与 D1
```

**核心：** GitHub `main` 是公开源码源，不是当前生产站点。公开页面只有同步到阿里云 OSS 并完成线上哈希与 HTTP 验证后才算发布。会员和反馈由独立 Worker 处理，激活码仅以哈希形式存储在 D1。

---

## 二、DNS 配置

| 项目 | 值 |
|---|---|
| 域名注册 | 阿里云 |
| DNS 服务器 | `laura.ns.cloudflare.com` / `lennon.ns.cloudflare.com` |
| Cloudflare API Token | 通过 Cloudflare Secret 管理，不写入仓库 |

生产约束：

- 根域名和 `www` 指向阿里云杭州 OSS，备案整改与自动复查完成前保持 DNS-only；
- `vip-api` 是独立 Worker Custom Domain，不代表可以代理根域名；
- DNS、ICP备案控制台状态和证书均为时效信息，每次操作前重新读取生产现状；
- 不在文档中保存 OSS 访问密钥、Cloudflare Token、证书私钥或具体登录凭据。

---

## 三、网站部署

**更新流程：**
1. 告诉我需要改什么
2. 我修改代码（本地）
3. 推送或合并到 GitHub `main`，保留可审计源码提交
4. 仅同步本次已审核的公开文件到阿里云 OSS
5. 比对 OSS 对象与提交文件哈希，并对生产 URL 做 HTTP、静态资源和关键流程冒烟

**本地路径：**
```
/Users/gobyjohn/Documents/Codex/2026-07-26/ehs-sil-chatgpt-continuity/work/
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
| `dashboard/feedback-admin.html` | 仅服务端确认 `admin` 权益后可使用的反馈管理页 |
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
1. 通过受保护的 Worker 管理入口访问激活码功能
2. 管理凭据仅保存在平台 Secret 中，不写入本文档或前端代码
3. 点击「获取新激活码」→ 复制发给用户

> 历史版本曾在本文档记录管理凭据；该凭据必须视为已暴露并在服务端轮换。

**码库：** 激活码仅以哈希形式存储在服务端 D1 数据库
**管理：** 由受保护的服务端接口生成、吊销和查询
**浏览器：** 仅接收 HttpOnly 会话 Cookie，不接收激活码库


---

## 五、已知问题

| 问题 | 说明 | 状态 |
|---|---|---|
| GitHub 与生产不同步 | GitHub 提交不会自动使 OSS 生效 | 每次发布必须同步与验哈希 |
| OSS 目录路径 | `/tools/` 等目录形式可能返回 `NoSuchKey` | 导航使用显式 `index.html` |
| ICP 自动复查 | 根域名路由变更可能影响复查 | 2026-09-17 前不改变现有主站路由 |
| SSL 续期 | 免费证书有到期时间 | 2026-11-15 前完成续期并复核 |

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

**重要：** GitHub 保存公开源码，生产公开内容部署到阿里云 OSS；会员与反馈代码部署到私有 Worker。涉及新 API 的改动必须按“先 Worker 与 D1、完成冒烟；后 GitHub 与 OSS 前端”的顺序发布。回滚优先关闭或回退前端入口，保留已接收的反馈数据。

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
│   ├── admin-codes.html # 激活码管理入口（必须由服务端保护）
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

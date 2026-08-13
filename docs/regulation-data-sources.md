# EHS法规导航数据来源与再利用规则

## GitHub开放项目的用途

GitHub项目只用于发现官方接口、学习采集方法和校验数据结构，不直接把第三方仓库的数据当作法律权威来源。

- `legislation/data-documentation`：英国国家档案馆的 legislation.gov.uk 数据模型与公共API说明。
- `legislation/legislation-mcp-ts`：英国国家档案馆维护的 legislation.gov.uk MCP 示例。
- `Ansvar-Systems/UK-law-mcp`：基于 legislation.gov.uk API 的检索实现，可参考其来源追踪方式。
- `openlegaldata/awesome-legal-data`：各国官方法律开放数据入口清单。
- `twang2218/law-datasets`：中国国家法律法规数据库采集思路；仅作技术线索，正式数据仍回链国家法律法规数据库。

## 当前正式来源

| 地区 | 正式来源 | 本站策略 |
|---|---|---|
| 中国 | 国家法律法规数据库、应急管理部、生态环境部、国家标准全文公开系统 | 法规链接官方原文；标准不镜像，使用官方公开或购买入口 |
| 美国 | eCFR | 链接官方动态文本 |
| 欧盟 | EUR-Lex | 官方原文和EUR-Lex官方下载入口 |
| 英国 | legislation.gov.uk | 官方原文和官方PDF下载入口；保留OGL v3.0许可信息 |
| 国际标准 | ISO、IEC、NFPA、API等发布机构 | 仅官方阅读或购买，不托管未授权PDF |

## 下载含义

- “CSV”：下载法规导航元数据，不是法规或标准全文。
- “官方下载”：浏览器直接访问政府官方文件地址，文件不由EHS-SIL服务器镜像。
- 暂不提供“本站下载全文”。只有逐项确认许可、署名、版本和更新责任后，才考虑托管开放许可文本。

## 发布门槛

每条正式记录必须有：司法辖区、官方来源、下载策略、许可或条款链接、内部复核状态。来源不明、无许可或只来自GitHub镜像的记录不得进入正式导航。

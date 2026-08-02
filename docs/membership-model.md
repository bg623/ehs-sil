# 会员状态与激活数据模型

版本：1.1

状态：会员能力字段与合规导出权限已部署，并完成未登录会话线上验证

## 会员状态

- `free`：未激活专业权益；
- `legacy_vip`：原29.9元网站VIP，继续履约至原到期日；
- `toolbox_member`：129元外企EHS工具箱有效会员；
- `expired`：权益已到期；
- `admin`：内部管理与测试账户。

## 能力映射

| 会员状态 | `compliance_excel_export` | 说明 |
|---|---:|---|
| `free` | 否 | 可免费在线识别、筛选、查看详情、打印/PDF及下载固定示例 |
| `legacy_vip` | 是 | 仅为既有29.9元网站VIP继续履约至原到期日 |
| `toolbox_member` | 是 | 129元/年外企EHS工具箱会员包含网站专业工具权益 |
| `expired` | 否 | 到期后保留免费在线能力 |
| `admin` | 是 | 内部管理与测试 |

定制四表 Excel 与 `.ehsproject.json` 导入/导出均依赖服务端返回的 `compliance_excel_export`。前端每次执行前重新核验会话，不以按钮显示、缓存文案或本地字段作为授权依据。

## 激活数据最小字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `activation_code_hash` | text | 仅保存激活码哈希，不保存明文 |
| `entitlement_source` | enum | `legacy_vip`、`toolbox_member`或`admin` |
| `starts_at` | datetime | 权益开始时间 |
| `expires_at` | datetime | 权益到期时间 |
| `bound_user` | text/null | 用户标识；第一阶段允许为空 |
| `activation_status` | enum | `unassigned`、`active`、`expired`、`revoked` |
| `renewal_status` | enum | `none`、`pending`、`renewed`、`declined` |
| `source_ref` | text/null | 购买订单或后台来源的唯一引用 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 最近更新时间 |

## 迁移原则

- 现有激活码不得批量失效；
- 无法确认来源的现有有效码暂归 `legacy_vip`，由产品负责人核验后修正；
- 已批量生成的工具箱购买者激活码归 `toolbox_member`；
- 会员状态由服务端返回，浏览器不自行声明；
- 任何数据库迁移先在测试环境验证，再由产品负责人批准生产执行。

## 实施记录

- 私有包迁移：`ehs-sil-vip-worker/migrations/0003_member_entitlements.sql`；
- 新增字段：`entitlement_source`、`starts_at`、`bound_user`、`activation_status`、`renewal_status`、`updated_at`；
- 服务端会话返回会员状态和权益来源，浏览器只展示服务端结果；
- 服务端会话同时返回可用能力数组；合规导出能力授予`legacy_vip`、`toolbox_member`和`admin`；
- 停止销售独立29.9元网站VIP，但不削减既有用户在原有效期内的权益；
- 2026-07-29 已在临时SQLite数据库顺序执行0001、0002、0003迁移并验证结构；
- 本次能力字段部署不包含新的D1结构修改；后续数据库迁移仍须先验证并由产品负责人批准。
- 2026-08-02 已部署会员能力响应；线上未登录会话返回`active: false`与空`capabilities`数组，遵循默认拒绝原则。

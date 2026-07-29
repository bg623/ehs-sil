# 会员状态与激活数据模型

版本：1.0  
状态：实施设计，尚未部署数据库迁移

## 会员状态

- `free`：未激活专业权益；
- `legacy_vip`：原29.9元网站VIP，继续履约至原到期日；
- `toolbox_member`：129元外企EHS工具箱有效会员；
- `expired`：权益已到期；
- `admin`：内部管理与测试账户。

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


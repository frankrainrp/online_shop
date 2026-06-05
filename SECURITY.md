# 安全配置与分区（上线前必做）

## 核心原则
**前端永远不可信。** 所有敏感写操作必须走云函数做服务端校验；集合权限是第二道防线（客户端直连数据库时生效，云函数以管理员权限绕过）。**密钥永不出云端。**

---

## 一、信任分区（5 层）

| 层 | 谁能进 | 涉及数据/操作 | 把关方式 |
|---|---|---|---|
| **Z0 公开层** | 任何人（含未登录） | goods / banners / updates 只读 | 安全规则 `read:true,write:false` |
| **Z1 会员私有层** | 仅本人（openid） | 自己的 users / points_log / redeems | 云函数读写 + 规则按 openid 隔离 |
| **Z2 店员操作层** | staff + 7天会话 | addPoints / getMember / verifyRedeem | 云函数校验 staff 身份 + 会话未过期 |
| **Z3 管理层** | admin + 会话 | admin CRUD / staffGenSecret / getAudit / getDashboard | 云函数校验 role==='admin' + 会话 |
| **Z4 系统/密钥层** | 仅云函数 / 控制台 | staff.totpSecret、sec_lock、sec_otp、audit_log、env TOTP_SECRET | 客户端零访问；密钥只在云端生成/比对 |

**越层即拒**：低层身份调高层云函数一律 `{ok:false}`；会话过期降级为非店员。

---

## 二、集合权限矩阵（11 张，控制台逐张配）
控制台 →「数据库」→ 选集合 →「权限设置」→「自定义安全规则」→ 粘贴 → 保存。

| 集合 | 规则 | 说明 |
|---|---|---|
| `goods` `banners` `updates` | `{"read":true,"write":false}` | 公开目录，前端只读，改动走 admin 云函数 |
| `users` | `{"read":false,"write":false}` | 会员资料经 login/updateProfile 云函数读写 |
| `staff` | `{"read":false,"write":false}` | **含 totpSecret 密钥，绝对锁死** |
| `points_log` | `{"read":"doc.openid==auth.openid","write":false}` | 只读自己的流水 |
| `redeems` | `{"read":"doc.openid==auth.openid","write":false}` | 只读自己的兑换单 |
| `sec_lock` `sec_otp` | `{"read":false,"write":false}` | 登录锁定/防重放，仅云端 |
| `audit_log` | `{"read":false,"write":false}` | 操作日志，仅云端，管理员经 getAudit 读 |

> 公开三张是 `read:true`；其余**全部 `read:false`**，数据按需经云函数下发。

---

## 三、部署全部云函数（16 个）
```
init  login  signIn  addPoints  redeemGoods  verifyRedeem  updateProfile  getMember
admin  claimAdmin  resignStaff  staffSecret  getAudit  getDashboard  bindPhone  getPointsLog
```
> `getPointsLog` 读本人积分流水（云端身份，不依赖客户端规则）；`staffSecret` 已停用为 tombstone。
> ⚠️ `bindPhone` 用微信手机号能力，需小程序**已认证**并开通；存储手机号到 users（PII）。
> **隐私保护指引必须勾选「手机号」**，否则审核被拒、且违规收集 PII。users 集合已 `read:false` 锁死。

## 四、部署强依赖（不做=漏洞）
1. **`claimAdmin` 环境变量 `TOTP_SECRET`** 必须设为真实 base32 密钥。
   - 未设时占位符是公开已知的——代码已加防线：占位符未替换则**拒绝**主口令引导（开通不了店长，这是正确行为）。
2. **`init` 的 `makeMeStaff` 默认停用**（防无密钥提权后门）。开通首个店长走「员工入口」主口令；确需 init 引导时临时设 `ALLOW_BOOTSTRAP=on`，用完即关。
3. **会话 7 天**：店员离职用 admin「移除」或「重置码」即时失效其会话。

## 五、验证安全是否生效
1. 非店员账号进店员工作台 → getMember/addPoints 返回「无权限」。
2. Console 试 `wx.cloud.database().collection('users').doc('别人id').update({data:{points:99999}})` → permission denied。
3. Console 试读 `staff` / `audit_log` / 别人的 `points_log` → 读不到。
4. 商品/兑换页正常显示（公开读生效）；自己的积分明细/兑换可见（openid 规则生效）。

## 六、已落实的服务端校验（代码层）
| 云函数 | 校验 |
|---|---|
| addPoints | staff + 会话；delta 整数/范围；type 白名单；扣分原子防负；邀请奖励原子占用防重发 |
| redeemGoods | 服务端定价；库存/积分条件更新防超兑/double-spend；失败回滚 |
| signIn | 原子条件更新，一天一次防并发 |
| verifyRedeem | staff + 会话；状态原子更新防重复核销 |
| updateProfile | 仅 nickName/avatarUrl 白名单 + 长度 + 协议白名单 |
| getMember | staff + 会话才返回，最小字段 |
| admin | role==='admin' + 会话；字段白名单清洗；staffList 脱敏不回密钥 |
| claimAdmin | 个人/主口令；失败锁定 + 一次性消费；占位密钥拒绝引导 |
| getAudit / getDashboard | admin + 会话；只回必要数据 |

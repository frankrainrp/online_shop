# SECURITY_TEST.md — 安全测试报告 / 渗透自测清单

> 目标：确认普通用户**无法**越权、刷积分、拖库、白嫖。
> 测法：在小程序「调试器 Console」里粘贴下面的代码片段执行，对照"预期"。
> 原则：前端只读不写，一切变更必须走云函数的服务端校验；云函数自身做身份与数据校验。

## 总体结论
- 前端对敏感集合：**只读自己的 / 公开只读 / 完全不可读**，**一律不可写** → 由集合安全规则保证。
- 云函数：加分/兑换/核销/查会员/后台 全部**服务端鉴权**；改资料**字段白名单**。
- 本次审计发现并修复 1 个高危提权（init makeMeStaff）、1 处口令加固（静态→TOTP 动态码）。

---

## 攻击面测试矩阵

| # | 攻击意图 | 测试方法 | 预期（安全） | 防御点 |
|---|---|---|---|---|
| 1 | 给自己刷积分 | `db.collection('users').doc('x').update({data:{points:99999}})` | ❌ permission denied | users write:false |
| 2 | 拖库（读所有会员 openid/积分） | `db.collection('users').get()` | ❌ 报错或空 | users read:false |
| 3 | 偷看店员名单 | `db.collection('staff').get()` | ❌ 报错或空 | staff read:false |
| 4 | 伪造积分流水 | `db.collection('points_log').add({data:{delta:99999}})` | ❌ permission denied | points_log write:false |
| 5 | 篡改兑换单状态白嫖 | `db.collection('redeems').where({}).update({data:{status:'已完成'}})` | ❌ permission denied | redeems write:false |
| 6 | 把商品改成 0 积分 | `db.collection('goods').where({}).update({data:{cost:0}})` | ❌ permission denied | goods write:false |
| 7 | 读别人的兑换/流水 | `db.collection('redeems').get()` | ✅ 只返回自己的 | rule: doc.openid==auth.openid |
| 8 | 非店员给自己加分 | `wx.cloud.callFunction({name:'addPoints',data:{targetUserId:'我的',delta:9999}})` | ❌ result.msg=无权限 | addPoints 查 staff |
| 9 | 非店员核销 | `wx.cloud.callFunction({name:'verifyRedeem',data:{code:'x'}})` | ❌ 无权限 | verifyRedeem 查 staff |
| 10 | 非店员拖会员信息 | `wx.cloud.callFunction({name:'getMember',data:{memberNo:'x'}})` | ❌ 无权限 | getMember 查 staff |
| 11 | 非管理员改商品/加店员 | `wx.cloud.callFunction({name:'admin',data:{action:'list',collection:'goods'}})` | ❌ 无权限 | admin 查 role==admin |
| 12 | 改资料时偷加积分 | `wx.cloud.callFunction({name:'updateProfile',data:{nickName:'a',points:9999}})` | ✅ 仅改昵称，积分不变 | updateProfile 字段白名单 |
| 13 | 积分不足/超兑 | 兑换超过余额或库存为 0 的商品 | ❌ result.msg=积分不足/已兑完 | redeemGoods 服务端校验 |
| 14 | 重复签到刷分 | 同一天连点签到两次 | ❌ 第二次：今天已签到 | signIn 当天 lastSignAt 校验 |
| 15 | 调 init 把自己变管理员 | `wx.cloud.callFunction({name:'init',data:{makeMeStaff:true}})` | ✅ 已有管理员时被拒（防越权） | init 仅"无管理员时+本人" |
| 16 | 暴力破解管理口令 | 反复试口令 | TOTP 每 30s 变，窗口极小，几乎不可爆破 | claimAdmin TOTP |

> 验证 #1 报 `permission denied` 是**整套安全的总开关**——它过了，刷积分的路就焊死了。

---

## 本次审计发现 & 处置
1. **[高危·已修] init 提权**：`makeMeStaff` 原先无鉴权且接受任意 openid，任何人可调用变管理员。
   → 改为"仅当系统无任何管理员时、且只认本人 openid"才生效。
2. **[加固·已做] 管理口令 静态→TOTP**：原静态口令可被暴力/泄露长期利用。
   → 升级为 RFC6238 动态码（30s 轮换，已用官方测试向量校验实现正确）。

## 残留风险 & 建议（非阻断，建议上线后跟进）
- **claimAdmin 频率限制**：当前每次试码独立。建议加"同一 openid 连续失败 N 次锁定 5 分钟"，进一步抬高爆破成本。
- **云存储上传权限**：当前登录用户均可上传图片（仅 admin 真正能保存记录）。建议给云存储配安全规则，仅 admin 路径可写。
- **init 仍可被任意调用**：现已无害（幂等、makeMeStaff 已锁、写操作走集合规则），可不处理；洁癖可加一次性"安装锁"。

## 复测节奏
- 每次改动云函数/权限后，至少回归 #1、#8、#11、#12 四条。

---

# 深度安全审计（第二轮，2026-06-04）

> 参照真实积分/优惠券系统的常见被薅手段，逐行审计云函数业务逻辑。
> 核心思想：**前端权限/集合规则只是第一层；业务逻辑层的"读→判断→写"非原子操作，才是被并发刷的重灾区。**

## 常见攻击手段自查表（积分/电商类小程序）
| 类别 | 攻击手段 | 本项目状态 |
|---|---|---|
| 越权 (Broken Access Control) | 直接调云函数绕过前端按钮 | ✅ 每个写函数都在服务端查 staff/role 鉴权 |
| 越权 (IDOR) | 改 userId 参数操作他人数据 | ✅ 用户类操作一律以 OPENID 取本人，不信前端 userId |
| 前端篡改 | 改价格/积分价后提交 | ✅ 积分价/库存以服务端 goods 为准，忽略前端传值 |
| **并发竞态 (Race / 刷单)** | **同时发 N 个请求 double-spend** | ✅ 已修：redeemGoods/signIn/addPoints/verifyRedeem 改原子条件更新 |
| 超卖/负库存 | 并发兑换把库存刷成负 | ✅ 已修：`where(stock>0).update(inc-1)` 原子扣减 |
| 负积分 | 并发兑换/扣分把余额刷成负 | ✅ 已修：`where(points>=cost).update(inc-cost)` 原子扣减 |
| 重复领取 | 并发刷签到/重复核销 | ✅ 已修：签到/核销均原子条件更新，只有一个成功 |
| 业务逻辑 | 兑换已下架商品（知道 goodsId 直接调） | ✅ 已修：redeemGoods 校验 status==='on' |
| 注入 (NoSQL) | 传对象/操作符进 where | ✅ 关键入参做 typeof string / Number 校验，不直传对象 |
| 数值攻击 | 传超大/负/非整 delta | ✅ 已修：addPoints 限非零整数且 |delta|≤100000 |
| 信息泄露 | 拖库 users/staff、读他人流水 | ✅ 集合规则锁死；getMember 只回必要字段 |
| 暴力破解 | 狂试管理口令 | ⚠️ TOTP 30s 轮换已大幅抬高成本；**失败锁定待加（残留项）** |
| 重放 (Replay) | 截获 OTP 在窗口内重放 | ⚠️ 窗口 ±2 内可重放；可加一次性消费（残留项） |

## 本轮发现并修复（4 个真实漏洞）
1. **[高危] redeemGoods 并发 double-spend**：读余额→判断→扣款非原子，并发可把积分刷成负、白嫖多件。
   → 改为原子 `where(points>=cost).update(inc(-cost))`，失败回滚库存。
2. **[高危] redeemGoods 超卖**：原 `inc(-1)+stats.updated` 拦不住负库存。
   → 改为原子 `where(stock>0).update(inc(-1))`。
3. **[中] signIn 并发刷签到**：读 lastSignAt→判断→发奖非原子，并发可一天领多次。
   → 改为原子 `where(lastSignAt<今日0点).update(...)`，并发只有一个成功。
4. **[中] verifyRedeem 并发重复核销 / addPoints 并发扣成负**：
   → verifyRedeem 改 `where(status==='待核销').update('已完成')`；addPoints 扣分改原子 `where(points>=N)`。
   → 附带：redeemGoods 增加「下架商品不可兑」业务校验；addPoints 增加 delta 范围与 type 白名单。

## 残留风险（非阻断，建议上线后跟进）
- **claimAdmin 失败锁定**：同一 openid 连续失败 N 次锁 5 分钟（防 OTP 暴力）。
- **OTP 一次性消费**：核销过的码记入已用集合，杜绝窗口内重放。
- **云存储上传权限**收紧到 admin。
- **店员操作审计**：addPoints 的大额操作可加二次确认 / 留更详细审计日志。

## 并发漏洞复测方法
> 用脚本或快速连点模拟并发，验证修复：
- 余额刚好够兑 1 件时，**快速连点兑换多次** → 只成功 1 次，余额不为负、不超兑
- 当天**连点签到多次** → 只 +10 一次
- 同一兑换码**两个店员同时核销** → 只 1 个成功，另一个提示已核销

---

# 第三轮：黑客视角 / 极端 & 非常见攻击复审（2026-06-04）

> 方法：把用户与管理员的完整流程在脑中重演，每一步问"如果我是攻击者，能怎么破？"

## 流程重演 + 攻击设想
1. **进入→login**：能伪造 openid 吗？→ 不能，OPENID 来自平台上下文，非客户端传入。✅
2. **签到/兑换**：并发刷？→ 已上一轮原子化修复。✅
3. **改资料**：avatarUrl 塞 `data:`/`javascript:`/外链？→ ✅ 已限制只接受 `cloud://` 或 `https://`。
4. **成为管理员（OTP）**：
   - 暴力狂试？→ ✅ 失败 5 次锁 5 分钟（按"攻击者自己的 openid"锁，**锁不到真管理员**）。
   - 截获 OTP 重放？→ ✅ 一次性消费（code+step 用过即作废）。
   - 并发同码多次提交造重复 staff？→ ✅ 一次性消费顺带挡掉。
5. **店铺后台**：填负库存/负积分价/小数/超大值？→ ✅ admin 数字字段整数化 + 非负 + 上限钳制。
6. **直接调 init 提权/重置**：→ ✅ makeMeStaff 仅"无管理员时+本人"；init 本体"已初始化后非管理员直接拒"。
7. **跨集合 id 混用**（拿 banner 的 id 当 goodsId 兑换）：→ doc() 只在 goods 集合查，查不到即"商品不存在"。✅
8. **越权读他人**（getMember 枚举会员）：→ 仅店员可调，且会员号是随机 _id 难枚举，只回必要字段。✅
9. **锁定 DoS 真管理员**：→ 不行，锁定按调用者 openid；攻击者拿不到有效码，无法预消费来污染。✅

## 本轮新增加固
- updateProfile：avatarUrl 协议白名单（cloud://、https://）。
- admin：数字字段整数化、非负、≤1e9。
- claimAdmin：失败锁定（5 次/5 分钟）+ OTP 一次性消费（防重放）。新增内部集合 `sec_lock`、`sec_otp`（仅云函数读写）。
- init：已初始化后非管理员调用拒绝。

## 部署/运维层面需注意（非代码）
- **不要给任何云函数开 HTTP 触发器**：否则可被无登录态外部调用（拿不到 OPENID，鉴权逻辑可能被绕）。保持仅小程序内调用。
- **sec_otp / sec_lock 定期清理**：随时间增长，建议加定时触发云函数清理 7 天前的记录；并给 sec_otp 建 (code, step) 索引。
- **sec_lock / sec_otp 集合权限**：设「所有用户不可读写」（只云函数访问）。
- 集合规则改动后回归并发三连测（见上）。

## 已知可接受的残留（风险低）
- 店员/管理员属半可信角色：被盗号后可在其权限内造成损失（加分上限 10 万/次已限）。建议大额操作留审计、定期核对。
- nickName 可设成"客服/管理员"等做社工，仅展示无权限影响。
- 云端测试无 OPENID 时调用 claimAdmin 会落到 openid=undefined 的 staff 记录（不影响真实用户，建议别这么用）。

---

## 第四轮审查（2026-06-05｜认证/会话/审计/抵现/裂变/看板）

**修复（本轮）**
- 🔴 **claimAdmin 占位主口令提权**：未配 `TOTP_SECRET` env 时占位符公开已知，他人可在无 staff 记录时算码引导成 admin。已加防线：占位符未替换则拒绝主口令引导。
- ✅ **staffList 密钥泄露**（上轮已修，复核）：admin staffList 脱敏，不回 totpSecret，仅 hasSecret/sessionValid。
- ✅ **login 脱敏**：staffInfo/staffState 不含 totpSecret。

**复核通过**
- 会话：addPoints/verifyRedeem/getMember/admin/getAudit/getDashboard 均校验 `sessionExpireAt > now`，过期 expired。
- 认证：一人一密钥；sec_lock 失败锁定 + sec_otp 一次性消费(按 openid+code+step)；TOTP 经 RFC6238 向量。
- 原子性：加/扣分、抵现、核销、兑换、**邀请奖励**(inviteRewarded false→true 占用)均原子，防并发重复。
- 裂变防刷：仅首注册绑定 invitedBy + 校验邀请人存在且非自邀 + 每人只返一次 + **须真实消费(type=消费)才发**；固定 1500 不经 delta 通道，安全。
- 数据最小化：getMember 仅必要字段；getDashboard 仅聚合数字；getAudit 仅 admin。

**部署强依赖（不配=漏洞）**
- **必须配 `TOTP_SECRET` 环境变量**（否则主口令引导被禁用，无法开通首个店长——这是正确行为，但要记得配）。
- **`audit_log` 安全规则**：所有用户不可读写（仅云端），客户端只经 getAudit 读。
- 云存储权限「所有用户可读，仅创建者可读写」→ 任意登录用户可上传文件，有被刷存储风险；彻底收紧需改走云函数上传（列后续）。
- sec_otp/sec_lock/audit_log 随用量增长，建议定时清理 + 索引。

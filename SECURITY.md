# 安全配置（上线前必做）

## 核心原则
**前端永远不可信。** 所有敏感写操作（积分、兑换、核销、改资料）必须走云函数做服务端校验。
集合权限是第二道防线：直接锁死前端对数据库的访问，云函数（管理员权限）会自动绕过这些规则，照常工作。

## 一、部署全部云函数（共 9 个）
```
init  login  signIn  addPoints  redeemGoods  verifyRedeem  updateProfile  getMember  admin
```
改过代码的（updateProfile / getMember / init）记得重新「上传并部署」。

## 二、给 6 张集合配安全规则
控制台 →「数据库」→ 选集合 →「权限设置」→「自定义安全规则」→ 粘贴对应 JSON → 保存。

### goods / updates / banners —— 公开目录（所有人可读，前端不可写）
```json
{
  "read": true,
  "write": false
}
```

### users / staff —— 彻底锁死（只有云函数能碰）
```json
{
  "read": false,
  "write": false
}
```
> 会员资料前端通过 login / updateProfile 云函数读写；店员名单只在云函数里查。

### points_log / redeems —— 只能读自己的，谁都不能写
```json
{
  "read": "doc.openid == auth.openid",
  "write": false
}
```
> 这两张表每条记录都存了 `openid` 字段，规则按它放行"本人可读"。写操作全走云函数。

## 三、验证安全是否生效
1. 用非店员账号进店员工作台 → 应被拦截（getMember/addPoints 返回"无权限"）。
2. 前端控制台试 `wx.cloud.database().collection('users').doc('别人的id').update({data:{points:99999}})`
   → 应失败（permission denied）。这条过不了，才算锁住了刷积分。
3. 商品、兑换页能正常显示（goods/updates 公开读生效）。
4. 我的积分明细、我的兑换能看到自己的记录（openid 规则生效）。

## 已落实的服务端校验（代码层）
| 云函数 | 校验 |
|---|---|
| addPoints | 调用者必须在 staff 集合；扣分不能扣成负 |
| redeemGoods | 服务端验积分余额、库存；条件更新防超兑 |
| verifyRedeem | 调用者必须是店员；防重复核销 |
| updateProfile | 只接受 nickName/avatarUrl 白名单字段，碰不到 points |
| getMember | 调用者必须是店员才返回会员信息 |
| admin | 调用者必须 role==='admin'；按集合字段白名单清洗，杜绝注入任意字段 |

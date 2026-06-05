# 是模玩店！积分会员小程序（MVP）

原生小程序 + 微信云开发。纯积分、零支付。一个人即可运行维护。

## 技术栈
- 前端：原生小程序（WXML/WXSS/JS）
- 后端：微信云开发（云数据库 + 云函数 + 云存储）
- 主题：赛博紫黑霓虹，颜色集中在 `app.wxss` 顶部变量，换肤只改这里

## 目录结构
```
├── app.js / app.json / app.wxss   全局入口、路由、主题
├── pages/
│   ├── index/          首页
│   ├── member/         会员中心（"我的" Tab）
│   ├── points/         我的积分
│   ├── points-log/     积分明细
│   ├── redeem/         积分兑换（Tab）
│   ├── my-redeems/     我的兑换
│   ├── member-code/    会员码（Tab）
│   ├── goods-update/   商品更新
│   └── staff/          店员工作台
├── cloudfunctions/
│   ├── init/           ⭐一键初始化：建集合+灌示例数据+设店员（幂等）
│   ├── login/          拿 openid + upsert 会员 + 判断店员
│   ├── signIn/         每日签到领积分（会员自助攒分）
│   ├── addPoints/      店员加/扣积分（店员鉴权）
│   ├── redeemGoods/    会员兑换商品（扣分扣库存生成兑换单）
│   └── verifyRedeem/   店员核销兑换码（店员鉴权）
├── utils/
│   ├── format.js       等级/日期/单号工具
│   └── config.js       业务规则集中配置（积分规则/分类/集合名）
└── seed/               示例数据（goods / updates，手动导入备用）
```

## 数据库集合（5 张）
在云开发控制台「数据库」里新建以下集合（名字必须一致）：

| 集合 | 说明 | 关键字段 |
|---|---|---|
| `users` | 会员 | openid, nickName, avatarUrl, points, growth, level, createdAt |
| `points_log` | 积分流水 | userId, type, delta, balance, orderNo, remark, createdAt |
| `goods` | 兑换商品 | name, category, cost, stock, image, status('on'), createdAt |
| `redeems` | 兑换单 | userId, goodsId, goodsName, cost, code, status, createdAt |
| `staff` | 店员 | openid, name, jobNo, role |
| `updates` | 商品更新/公告（可选） | type, title, desc, image, createdAt |

### 集合权限（重要）
在每个集合的「权限设置」里：
- `users` / `points_log` / `redeems`：选「仅创建者可读写」或「自定义」。**所有写操作都走云函数**，所以也可设为「所有人不可读写」由云函数兜底（云函数有管理员权限）。
- `goods` / `updates`：选「所有人可读，仅管理员可写」（前端要读列表）。
- `staff`：「所有人不可读写」（只在云函数里查）。

> 偷懒可先全设「所有人可读写」跑通流程，上线前再收紧。

## 跑起来（推荐：一键初始化）

1. **开通云开发**：微信开发者工具打开本项目 → 顶部「云开发」→ 开通 → 复制环境 ID。
2. **填环境 ID**：把 `app.js` 里 `envId: 'CHANGE-ME-ENV-ID'` 改成你的环境 ID。
3. **部署全部云函数**：右键 `cloudfunctions/` 下每个函数 → 「上传并部署：云端安装依赖」。
   （init / login / signIn / addPoints / redeemGoods / verifyRedeem 共 6 个）
4. **跑一次 init**：云开发控制台 → 云函数 → `init` → 「云端测试」→ 请求参数填
   `{ "makeMeStaff": true }` → 调用。
   它会自动：建好 6 张集合 + 灌入示例商品/动态 + 把你设成店员。
   返回的 `log` 里能看到每步结果。
5. 编译运行 → 首页有新品、兑换页有 6 个商品、「我的」页底部出现「🛠 店员工作台」。

> init 是**幂等**的：重复调用不会重复灌数据，集合已存在会自动跳过，随时可放心再跑。

### 备用：手动初始化
不想用 init 的话：手动建 6 个集合（见上表）→ 数据库导入 `seed/goods.json`、`seed/updates.json`
→ 在 `staff` 集合手动加 `{ "openid": "你的openid", "name": "店长", "jobNo": "D1001", "role": "admin" }`
（openid 可在云开发「用户管理」或自己的 `users` 记录里找到）。

## 核心闭环（已打通）
```
会员进入 → login 建会员
  ↓
会员码页出示「会员号」
  ↓
店员工作台 输入/扫会员号 → 查询 → +积分  →  addPoints 云函数
  ↓
会员「我的积分 / 积分明细」实时看到
  ↓
会员「积分兑换」选商品 → redeemGoods（扣分扣库存，出兑换码）
  ↓
会员「我的兑换」出示兑换码
  ↓
店员工作台 输入/扫兑换码 → 核销 → verifyRedeem（标记已完成）
```

## 待补 / 下一步（Next Step）
- **会员码二维码图像**：当前会员码页用「会员号」文字 + 店员手输/扫码已能闭环。
  要真正的二维码：`npm i weapp-qrcode`，在 `pages/member-code` 用 canvas 把 `memberNo` 画成 QR，
  店员页 `wx.scanCode` 即可直接扫。
- **tabBar 图标**：现为纯文字。补 4×2 张 81×81 png 到 `assets/tab/`，在 `app.json` 的 tabBar.list 里加回 iconPath/selectedIconPath。
- **商品/活动后台**：目前靠 init 灌示例 / 云开发控制台手动加数据。量大后可做个简单管理页或用云开发 CMS。
- **连续签到奖励**：现签到固定 +10 分；可扩展连签 N 天递增（在 signIn 云函数加 streak 逻辑）。
- **积分过期**：如需 12 个月过期，加定时触发器云函数扫 points_log。

## 主题换肤
改 `app.wxss` 顶部 `page { --bg / --primary / --accent ... }` 即可全局换色。
想要图里那种亮色/复古风，复制一套变量切换即可。

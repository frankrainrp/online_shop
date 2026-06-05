# CLAUDE.md — 项目说明（给 AI 协作者与开发者）

## 这是什么
**是模玩店！** 是一家 ACGN 模型/手办/周边实体店的**积分会员小程序**。
定位：会员消费攒积分 → 积分兑换好礼/优惠券 → 线下核销。**纯积分、零支付**（不接微信支付）。

> 注意：这是独立项目，和「Butler」项目无关，仓库各自独立。

## 技术栈
- 前端：**原生微信小程序**（WXML / WXSS / JS），不用框架
- 后端：**微信云开发**（云数据库 + 云函数 + 云存储），免服务器、免备案
- 视觉：**暗黑科技风**（黑底 #151515 + 品牌红 #E5332A 高亮 + 白字），参照 assets/sample_effect.jpg
- 品牌：店名字标 `assets/logos/字体png.png`，吉祥物 `assets/logos/logo.png`（赛博浣熊）
- 规矩：**界面内不使用任何 emoji**，图标一律走素材图（见 IMAGE_ASSETS.md）
- 打包：`assets/logos` 下的 .psd/.ai/大卡片图已在 project.config.json 的 packOptions.ignore 排除（超 2MB 主包限制）

## 目录结构
```
wechat_programe/
├── app.js / app.json / app.wxss      入口 / 路由·tabBar·导航 / 全局主题token
├── project.config.json               工程配置（cloudfunctionRoot 指向 cloudfunctions/）
├── pages/                            9 个页面，每页 .js/.wxml/.wxss/.json
│   ├── index/          首页（网购式：轮播+导航+商品流）
│   ├── redeem/         积分兑换（tab）
│   ├── member-code/    会员码（tab）
│   ├── member/         会员中心 / 我的（tab）
│   ├── points/         我的积分
│   ├── points-log/     积分明细
│   ├── my-redeems/     我的兑换
│   ├── goods-update/   商品更新 / 公告
│   ├── staff/          店员工作台（店员专用）
│   └── admin/          店铺管理（商品/轮播/动态 CRUD，仅 admin）
├── cloudfunctions/                  9 个云函数（业务逻辑+鉴权都在这）
│   ├── init/           一键初始化（建表/灌数据/设店员，幂等）
│   ├── login/          openid + upsert 会员 + 判店员
│   ├── signIn/         每日签到领积分
│   ├── addPoints/      店员加/扣分（店员鉴权）
│   ├── redeemGoods/    兑换（验余额/库存）
│   ├── verifyRedeem/   核销（店员鉴权）
│   ├── updateProfile/  改昵称/头像（白名单字段）
│   ├── getMember/      店员按会员号查会员（店员鉴权）
│   └── admin/          后台 CRUD（role==='admin' 鉴权 + 字段白名单）
├── utils/
│   ├── format.js       等级/日期/单号
│   └── config.js       业务规则集中配置（积分规则/分类/集合名）
├── seed/               示例数据（备用手动导入）
├── PROGRESS.md         ⭐进度与任务清单（权威进度源）
├── SECURITY.md         安全配置（集合权限规则）
├── IMAGE_ASSETS.md     UI 素材清单（尺寸/配色/风格）
├── SKILL.md            AI 协作者身份切换指南
└── README.md           跑起来教程
```

## 数据库集合
| 集合 | 用途 | 关键字段 |
|---|---|---|
| users | 会员 | openid, nickName, avatarUrl, points, growth, level, lastSignAt |
| points_log | 积分流水 | userId, openid, type, delta, balance, orderNo, createdAt |
| goods | 兑换商品 | name, category, cost, stock, image, status('on'), createdAt |
| redeems | 兑换单 | userId, openid, goodsId, goodsName, cost, code, status |
| staff | 店员 | openid, name, jobNo, role |
| updates | 动态/公告 | type, title, desc, image, createdAt |
| banners | 首页轮播 | image, title, link, sort |

## 核心数据流
```
进入 → login 建会员
会员码出示会员号 → 店员工作台 getMember 查 → addPoints 加分 → points_log 流水
积分兑换 redeemGoods（扣分扣库存出兑换码）→ 我的兑换出示码 → verifyRedeem 核销
```

## 开发约定（重要）
1. **任何敏感写操作必须走云函数**做服务端校验，前端禁止直写 users/points_log/redeems/goods/staff。
2. **WXSS 选择器不要用中文**（编译器会炸），状态映射成英文 class。
3. **不使用 emoji**，所有图标用 `/assets/...` 素材图，缺图时用色块占位。
4. **改业务规则**先改 `utils/config.js`（前端）+ 对应云函数里的同名常量（已注释标出）。
5. **进度更新**写进 `PROGRESS.md` 并追加更新日志。

## 当前状态
M1-M3 完成（脚手架/框架/安全代码）；M4 视觉改版进行中。详见 PROGRESS.md。

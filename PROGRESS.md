# 是模玩店！小程序 — 进度与任务清单

> 本文件是项目**权威进度源**。每完成一项把 `[ ]` 改成 `[x]`，并在底部「更新日志」追加一行。
> 状态图例：`[x]` 完成 · `[~]` 进行中 · `[ ]` 待办 · `[!]` 受阻

---

## 里程碑总览
- **M1 脚手架**：10 页面 + 11 云函数 + 数据流闭环 —— ✅ 完成
- **M2 基础框架**：一键 init、签到、配置集中化 —— ✅ 完成
- **M3 安全加固**：权限锁死 + 服务端校验 + TOTP + 安全审计 —— ✅ 完成
- **M4 视觉改版**：黑白红配色(接入真实 logo) + 首页网购化 + 去 emoji —— ✅ 完成
- **M5 功能补全**：管理后台 + 店员管理 + 头像云存储 + UI 口令登录 —— 🚧 主体完成，余 4 项
- **M6 上线准备**：素材齐、隐私协议、审核、体验版 —— ⬜ 待办
- **M7 测试验收**：用户线 / 管理员线 分支体验测试（见 TEST_CHECKLIST.md）—— 🚧 进行中

---

## M4 视觉改版 ✅
- [x] 全局换 **黑/白/红配色**（品牌红 #E5332A，取自真实 logo 橙红），app.wxss token + app.json 导航/tabBar
- [x] 首页改**标准网购格式**：字标 + 搜索栏 + swiper 轮播 + 图标导航 + 商品瀑布流；去掉积分入口卡
- [x] 全局**去除所有 emoji**，改图标占位/纯文字
- [x] 接入真实品牌素材（首页字标、员工入口吉祥物）；大文件 packOptions.ignore 排除出包
- [x] 管理员模式精简「我的」页（只留管理功能）

## M5 功能补全（主体完成，余 4 项）
- [x] **店内管理页** `pages/admin`（商品/轮播/动态/店员 四 tab，增删改 + 图片上传云存储），仅 admin
- [x] **轮播图 banners** 集合 + init 灌种子 + 首页读取
- [x] **店员管理** tab（按会员号增删店员/管理员）
- [x] **头像上传云存储**（chooseAvatar → uploadFile → fileID 持久化）
- [x] **新客入会礼**（首登 +120）+ **每日签到**（+10，防重复）
- [ ] **我的优惠券**独立页（区分"优惠券类"兑换记录，展示券码/有效期）
- [ ] **会员码真二维码**（npm weapp-qrcode，店员扫码加分/核销）
- [x] **商品详情页** `pages/goods-detail`（大图/积分价/库存/描述 + 立即兑换；首页&兑换页点商品进入）；goods 加 desc 字段
- [x] **icon 组件**（`components/icon`，SVG 图标统一入口，首页导航/我的宫格已迁移）
- [ ] **连续签到**奖励递增
- [ ] **消费积分 & 积分抵现**（核心商业逻辑）：
  - 攒分：消费 **1 元 = 1 积分**（店员工作台「按消费额加分」，输入消费金额自动换算）
  - 抵现：**100 积分 = 1 元**（结算时积分抵扣，店员「积分抵现」按金额扣分并记流水）
  - 需：管理员可配比率（config.js 已有 YUAN_TO_POINT，新增 POINT_TO_YUAN=100）；店员工作台加「按消费额加分 / 积分抵现」两个入口；抵现走 addPoints 负向 + type='抵现' 流水

## M6 上线准备
- [x] 控制台配齐集合安全规则（见 SECURITY.md / SECURITY_TEST.md）
- [ ] 补齐 UI 素材（见 IMAGE_ASSETS.md）：tabBar 图标、导航图标、Banner
- [ ] 商品实拍图 / 占位图替换
- [ ] 小程序「用户隐私保护指引」配置（获取头像/昵称必需）
- [ ] 真机体验版 → 提交审核

## M5 残留安全建议（非阻断，见 SECURITY_TEST.md）
- [x] claimAdmin 连续失败 5 次锁 5 分钟（sec_lock）
- [x] OTP 一次性消费防重放（sec_otp）
- [x] avatarUrl 协议白名单 / admin 数字字段钳制 / init 已初始化后拒绝
- [ ] 云存储上传权限收紧到 admin
- [ ] sec_otp/sec_lock 定期清理（定时触发）+ 索引
- [ ] 积分有效期与到期提醒（定时触发云函数）

---

## 已完成（M1-M3 明细）
- [x] 9 页面骨架：首页/会员中心/我的积分/积分明细/积分兑换/我的兑换/会员码/商品更新/店员工作台
- [x] 8 云函数：init / login / signIn / addPoints / redeemGoods / verifyRedeem / updateProfile / getMember
- [x] 数据流闭环：会员码→加分→流水→兑换→核销
- [x] 一键 init（幂等建表+灌数据+设店员）
- [x] 安全：前端零直写敏感集合；加分/兑换/核销/改资料/查会员全部服务端校验
- [x] WXSS 中文选择器 bug 修复（my-redeems 状态 class 改英文映射）

---

## 更新日志
- 2026-06-04 M1 脚手架完成
- 2026-06-04 M2 基础框架（init/signIn/config）完成
- 2026-06-04 M3 安全加固代码完成（updateProfile/getMember）
- 2026-06-04 修复 my-redeems 中文 class 编译错误
- 2026-06-04 启动 M4 视觉改版（B站配色 / 首页网购化 / 去 emoji）
- 2026-06-04 M4 主体完成：app.wxss 换 B站浅色 token、app.json 导航/tabBar 改色、首页重构为网购格式（搜索+轮播+导航+商品流）、全局去 emoji、banners 集合接入 init+首页
- 2026-06-04 新增四份文档：PROGRESS / CLAUDE / SKILL / IMAGE_ASSETS
- 2026-06-04 M5 店内管理页完成：admin 云函数（role 鉴权 + 字段白名单）+ pages/admin（商品/轮播/动态 CRUD + 云存储传图）；「我的」页加管理员入口
- 2026-06-04 修复 /assets/icons 图片 500（用 Node 生成 7 图标+1 商品占位 PNG，可同名替换真图）
- 2026-06-04 加固首次进入登录：login 成败都放行等待页面（loginReady+waiters 队列），避免 await getUser 卡死/timeout
- 2026-06-04 新客入会礼做实：login 首次建会员即 +120 积分并写"入会"流水（同步 config NEW_MEMBER_BONUS）
- 2026-06-04 UI 口令登录：claimAdmin 云函数（凭 ADMIN_SECRET 口令成为管理员）+ pages/staff-login（员工入口页）+「我的」页入口，免操作数据库
- 2026-06-04 控制台配齐 6 张集合安全规则（goods/updates 公开读、users/staff 锁死、points_log/redeems 按 openid 只读自己）—— 安全闭环成立
- 2026-06-04 店员管理 tab：admin 页第 4 个 tab，按会员号设店员/管理员 + 删除（不能删自己），加店员从此全 UI
- 2026-06-04 安全审计（见 SECURITY_TEST.md）：修复 init makeMeStaff 高危提权（仅无管理员时+本人）；管理口令静态→TOTP 动态码（RFC6238，官方向量验证通过）；员工入口隐藏到"我的"页连点版本号 7 下
- 2026-06-04 退出登录：resignStaff 云函数（退自己）+ 员工入口页"退出员工身份"按钮，便于验证 OTP 复登
- 2026-06-04 修复头像/昵称保存：onChooseAvatar 改为先 uploadFile 到云存储再存 fileID（原存临时路径会失效）；昵称空值不提交；失败提示区分"updateProfile 未部署"
- 2026-06-04 修复头像"没有可更新字段"：updateProfile 字段长度上限 nickName≤50 / avatarUrl≤512（云存储 fileID 很长，原 50 上限把它过滤掉了）
- 2026-06-04 修复昵称回退"新会员"：saveProfile 成功后 refreshUser 从数据库回读，显示以 DB 为准
- 2026-06-04 默认头像 + 可编辑角标 + "点击修改"提示
- 2026-06-04 OTP 真实可跑：新增 tools/otp.js 本地出码工具（node tools/otp.js 打印当前码）；TOTP_SECRET 换 32 位 base32（兼容验证器 App），claimAdmin 与工具同步；窗口放宽 ±2，失败回传服务器时间便于诊断时钟
- 2026-06-04 修复图片上传错误被掩盖：admin/member 上传失败原来统一报"已取消"，改为弹出真实 errMsg（多为云存储权限）；上传框放大 + 表单底部安全区留白
- 2026-06-04 管理员模式精简"我的"页：isAdmin 时只显示管理功能（店铺管理/店员工作台/退出），隐藏积分卡/权益/会员功能
- 2026-06-04 接入真实品牌：配色全改黑/白/红（品牌红 #E5332A，呼应 logo 橙红）；首页加店名字标、员工入口加吉祥物；占位图标改红；project.config.json packOptions.ignore 排除 logos 下 psd/ai/大卡片图（防超 2MB 主包）
- 2026-06-04 清理 PROGRESS（里程碑/重复项/已完成项）；新增 TEST_CHECKLIST.md（用户线/管理员线/安全线/边界 共 4 大块分支体验测试）
- 2026-06-04 配色按用户参考图(sample_effect.jpg)改为**暗黑科技风**：黑底 #151515 + 红高亮 + 白字；app.wxss token 全翻暗、app.json 导航/tabBar 转暗；各页写死的白卡片背景改 var(--bg-card)；首页顶部换红色 Hero（白字+浣熊，替掉暗底糊掉的黑橙字标）
- 2026-06-04 修复 admin 弹层溢出：`constant(safe-area-inset-bottom)` 旧语法使整条 padding 作废→左右内边距丢失贴边；改单独写 padding + box-sizing；输入框 width:100% border-box；滚动区 min-height:0 保存按钮固定可见；删头像可编辑角标（渲染成怪月牙残留）
- 2026-06-04 **深度安全审计第二轮**（见 SECURITY_TEST.md）：修复 4 个并发竞态漏洞——redeemGoods double-spend/超卖、signIn 刷签到、verifyRedeem 重复核销、addPoints 扣成负，全改数据库原子条件更新 where(条件).update()；redeemGoods 加下架商品不可兑；addPoints 加 delta 范围+type 白名单+入参类型校验
- 2026-06-04 **安全第三轮（黑客视角复审）**：claimAdmin 加失败锁定(sec_lock,5次/5分)+OTP一次性消费(sec_otp,防重放)；updateProfile avatarUrl 协议白名单；admin 数字字段整数化非负钳制；init 已初始化后非管理员拒绝；init 建 sec_lock/sec_otp 表。SECURITY_TEST.md 增"流程重演+极端攻击"自查与部署注意（禁 HTTP 触发器、定期清理 sec 表）
- 2026-06-04 功能：新增 icon 组件（SVG 统一入口，首页导航/我的宫格迁移）+ 商品详情页（goods 加 desc；首页/兑换页点商品进入，详情内直接兑换）
- 2026-06-04 接入用户 SVG 图标（assets/wechat_icons_svg）：按对照表复制到 icons/(redeem/code/coupon/sign/activity/record/gift) 与 tab/(home/redeem/code/me)；搭自定义 tabBar（custom-tab-bar 组件，4 tab 页 onShow 设 selected）；整理 assets（设计源文件归 source/，更新 packOptions.ignore）
- 2026-06-04 SVG 渲染坑：图标自带深色磁贴底+透明留白+滤镜文字，微信渲染不全/看不见；用 @resvg/resvg-js（tools/svg2png）渲染+去文字+cropByBBox 裁紧→透明 PNG，icon 组件+tabBar 切 PNG；尺寸多轮按用户口径调整
- 2026-06-04 首页导航精简为 3 项（删与 tabBar 重复的 积分兑换/会员码，留 我的兑换/签到/上新）；新增搜索页 pages/search（按 name/category 正则查在售商品 + 热门词 + 结果跳详情），首页搜索栏可点进入
- 2026-06-04 接入用户补全的 voucher/birthday PNG 图标（裁紧透明边），换到「我的」页优惠券/生日礼券
- 2026-06-04 GitHub 备份（frankrainrp/online_shop）：清理 OIP.webp，.gitignore 排除 node_modules/assets/source；**安全：TOTP 密钥从代码移到环境变量+本地 .totp_secret，仓库不含真实密钥**
- 2026-06-04 全局名改「是模玩店！」（UI+8 份文档）
- 2026-06-04 **尺寸/布局真机审计（见 SIZE_DEBUG.md）**：修复 真机两列网格掉单列（calc(50%-10)凑满100%→改-14留余量，index/redeem/search）、admin .mask inset:0→写全四边、goods-detail 底栏 env() 进 padding 简写→拆开；确认横滑项 flex-shrink、box-sizing、rpx、tab 页底部留白均安全

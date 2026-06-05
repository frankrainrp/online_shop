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
- [x] **会员码真二维码**（自带纯 JS 编码器 utils/qrcode.js，免 npm 构建；会员号生成真二维码，店员 wx.scanCode 直接扫；会员号保留可复制兜底）
- [x] **商品详情页** `pages/goods-detail`（大图/积分价/库存/描述 + 立即兑换；首页&兑换页点商品进入）；goods 加 desc 字段
- [x] **icon 组件**（`components/icon`，SVG 图标统一入口，首页导航/我的宫格已迁移）
- [ ] **连续签到**奖励递增
- [x] **消费积分 & 积分抵现**（核心商业逻辑）：攒分「按消费额加分」1元=1分、抵现「积分抵现」100分=1元；店员工作台两入口带换算预览+余额校验+确认弹窗；抵现走 addPoints 负向(原子防扣负)+type='抵现' 流水；比率在 config.js（YUAN_TO_POINT/POINT_TO_YUAN）。比率「管理员后台可配」未做（改 config 即可，列后续）

## M6 上线准备
- [x] 控制台配齐集合安全规则（见 SECURITY.md / SECURITY_TEST.md）
- [ ] 补齐 UI 素材（见 IMAGE_ASSETS.md）：tabBar 图标、导航图标、Banner
- [ ] 商品实拍图 / 占位图替换
- [ ] **填真实信息**：`pages/rules/rules.js` 的 `shopName`（营业执照店名）、`contact`（真实客服/电话）
- [ ] **填真实信息**：小程序后台名称改「是模玩店！」；claimAdmin 重新部署前先在云函数环境变量设 `TOTP_SECRET`
- [ ] 小程序「用户隐私保护指引」配置（获取头像/昵称必需，规则页已引用）
- [ ] **新增集合 `audit_log` 安全规则**：锁死（仅云端可读写，客户端只经 getAudit 读）；与 staff/users 同级
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
- 2026-06-04 **商品多图**：goods 加 images 数组（最多9张），admin 表单 images 类型（多选上传/删除/封面标记），云函数 sanitize 校验数组+自动设 image=images[0] 兼容列表卡片；商品详情页大图改 swiper 轮播
- 2026-06-04 **法律声明（维护商家利益）**：新增 pages/rules「积分会员服务规则」（积分获取/使用/兑换核销/有效期/行为规范/隐私/免责/最终解释权归本店/适用中国法律），「我的」+「我的积分」入口链入；兑换确认弹窗加"积分立即扣除·到店核销·不退不换"免责。店名/客服为 TODO 占位需填真实信息
- 2026-06-05 **会员码真二维码**：新增 utils/qrcode.js（纯 JS QR 编码器，Arase/davidshimjs 核心移植，UTF-8 字节模式+自动选 version+最优掩码，免 npm 构建），drawQrcode() 用旧版 canvas-id 上下文绘制；member-code 页把会员号(users._id)生成真二维码，店员 staff 页 wx.scanCode 直接扫码加分/核销；canvas 边长按 windowWidth 把 360rpx 换算 px 保证绘制坐标与布局一致。Node 离线自测 v1/v3 矩阵 + 中文混合通过（后按用户要求去掉页面下方会员号复制块）
- 2026-06-05 **店员登录改造：一人一密钥 + 7天会话 + 全量审计**（PM 对齐后实施）：
  · 认证：放弃共享口令，改「一人一 TOTP 密钥」。claimAdmin 重构为动态码登录——有个人密钥用本人码续 7 天会话/角色不变；无 staff 记录用主口令(env TOTP_SECRET)引导成首个管理员并自动生成个人密钥(返回 otpauth 扫进验证器)；有记录但未启用→needEnroll。新增 staffSecret 云函数(店员自助生成/换机重置个人密钥)。base32 编解码+HOTP 经 RFC6238 官方向量(287082)+200 次 enroll 自测通过
  · 会话：staff 加 sessionExpireAt，login 按「在白名单 且 会话未过期」算 isStaff/isAdmin 并隐去 totpSecret；addPoints/verifyRedeem/getMember/admin 全部加会话过期校验(expired:true)；app.js 改用服务端 r.isAdmin
  · 审计：新增 audit_log 集合(init 建表)，加分/扣分/核销/登录/提权/启用·重置动态码/店员变更/商品·轮播·动态增删改 全部留痕(谁/何时/对谁/摘要)；新增 getAudit(admin+会话)；新增 pages/audit 操作日志页(筛选+触底分页)，员工入口页管理员可进
  · 前端：staff-login 页重构为 4 态(已登录/需启用/登录/主口令引导)+otpauth 二维码扫码启用+手动密钥+会话到期显示+重置入口；staff 页无权限文案更新指向员工入口重登
  · 说明：无短信无费用，靠验证器 App；店长吊销店员可用 admin staffResetSecret 或直接移除
- 2026-06-05 **安全第五轮(红队复查)**：修 init.makeMeStaff 无密钥提权后门(默认停用,需 ALLOW_BOOTSTRAP=on)；重写 SECURITY.md(5层信任分区+11集合权限矩阵+部署强依赖)；**P2 店员加分日限额**(非管理员每日>5万分拒绝)+**大额告警**(单次≥5000分 audit 标 big,summary 标⚠,加 amount 字段供聚合)
- 2026-06-05 **修三处反馈问题**：①上新动态卡片不可点→加 bindtap+详情弹层(完整图文/类型/日期, scroll-view)②积分明细"获取记录看不了"→根因 points_log 客户端直读依赖安全规则(没配则空)+wxml 过滤后空白；改：新增 getPointsLog 云函数(云端身份读本人,不依赖规则)、points-log 改 JS 过滤+分类空状态文案③员工入口两处过时文案(还写"自助启用密钥")→改为"联系店长生成码"，与"店长发配"一致
- 2026-06-05 **轻量丝滑包（感知优化，不碰真实性能）**：app.wxss 加全局动画地基——内容淡入 fadeInUp(.fade-in)、骨架流光 shimmer(.sk 系列)、点击反馈(可点元素 :active 缩放变暗)；首页商品流/兑换网格/积分明细/我的兑换 加载态显示**骨架屏**(灰块流光)替代白屏，数据回来 .fade-in 淡入；列表图片加 lazy-load。消灭"白屏→突现"，变"骨架→流光→平滑淡入"
- 2026-06-05 **手机号登录改「软引导」**（真机发现 getPhoneNumber 未认证不可用，强制拦截把自己也挡死）：移除首页强制跳登录；改为关键动作(签到/兑换)后端返回 needLogin 时，前端 app.promptLogin 弹「去登录」。认证前可正常浏览+测大部分，认证后手机号登录可用，上线安全靠后端兜底(无 phone 不能兑换/签到)。这是微信惯例(浏览不登录、操作才登录)
- 2026-06-05 **新客手机号一键登录**：新增 bindPhone 云函数(getPhoneNumber code→cloud.openapi 换手机号→存 users.phone,脱敏回传)；新增 pages/login(品牌+微信手机号一键登录按钮+隐私说明+店员入口);首页 onShow 拦截(已登录无 phone 且非店员→跳登录页,店员/在册员工豁免)。店长登录维持纯 TOTP+7天会话(满足"每周重登",无需改)。**依赖：小程序已认证+开通手机号能力+隐私指引勾选手机号**；users 加 phone(PII)已 read:false 锁死
- 2026-06-05 **店长后台发放动态码 + 修脱敏漏洞**：admin staffList 原样返回 staff 全量(含 totpSecret)→脱敏，只回 hasSecret/sessionValid；staffResetSecret 升级为 staffGenSecret(生成新密钥并返回 otpauth)；admin 页店员行加「生成码/重置码」按钮→弹二维码(canvas 画 otpauth)+手动密钥，店长当场给店员扫；店员行展示「已启用/已登录/未启用动态码」状态。主口令密钥已生成写入 tools/.totp_secret(已 gitignore)
- 2026-06-05 **消费积分 & 积分抵现（核心商业逻辑）**：config 加 POINT_TO_YUAN=100；addPoints 白名单加 '抵现'；店员工作台重构为 5 段（查会员/②按消费额加分 1元=1分/③积分抵现 100分=1元/④手动加扣/⑤核销），消费与抵现均输入金额自动换算分值+实时预览，抵现前端校验余额+确认弹窗、后端 addPoints 负向原子扣分防扣负、type='抵现' 入流水；积分明细按 delta 正负归类（抵现落「消费」筛选），无中文 class 问题
- 2026-06-05 **《上线操作清单.md》**：主体认证/隐私指引/类目/云端部署(含 TOTP_SECRET 环境变量+存储权限第1档+audit_log 安全规则)/首个管理员/真机自测/体验版提交，逐条可勾选；附费用备忘
- 2026-06-05 **增值功能①经营看板**（二期筹码，先落地）：新增 getDashboard 云函数(admin+会话, aggregate 聚合，数据复用 points_log/users/redeems：营业额=消费分总和÷1、抵现让利=抵现分÷100、新增会员、核销数、积分发放/消耗、消费笔数；今日按北京零点/近7天/近30天)；新增 pages/dashboard(范围切换+营业额 Hero+6 指标卡+下拉刷新，仅 admin)；员工入口加「经营看板」入口
- 2026-06-05 **增值功能②邀请有礼裂变（老带新·消费返）**：config 加 INVITE_REWARD=1500；login 接 inviter，仅「首次注册」绑定 invitedBy(校验邀请人存在+非自邀)；addPoints 在 type='消费' 且 inviteRewarded===false 时原子占用(防并发重发)→双方各+1500(growth 同增)+各写'活动'流水+邀请人 inviteCount+1+审计'邀请奖励'，返回 inviteReward 供店员弹窗提示；app.js onLaunch/onShow 捕获分享 query.inviter 暂存并透传 login；新增 pages/invite(玩法+我的拉新数+open-type=share 分享，path 带 inviter=本人 userId)；我的页加「邀请有礼」入口。**充值/储值经甲方否决不做**；**消息推送待甲方申请 3 个模板 ID 后接入**（一次性订阅，新品/活动无法群发，过期提醒需先做积分有效期+定时触发）

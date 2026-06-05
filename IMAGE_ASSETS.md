# IMAGE_ASSETS.md — UI 素材清单

> 风格统一：**二次元清爽风 + B站配色**。界面零 emoji，所有图标/插画走本清单素材。
> 放置目录：`assets/`（tab/ icons/ banner/ badge/ placeholder/ 分子目录）。
> 生成建议：图标可用 iconfont 导出统一线性图；Banner / 插画 / 吉祥物可用 AI 出图（提示词附后）。

## 配色规范（暗黑科技风：黑底 + 红 + 白，参照 sample_effect.jpg）
| 名称 | 色值 | 用途 |
|---|---|---|
| 页面底·近黑 | `#151515` | 页面背景 |
| 卡片·深灰 | `#222224` | 卡片/容器 |
| 输入/次容器 | `#2C2C2E` | 输入框 |
| 主色·品牌红 | `#E5332A` | 主按钮、选中态、价格/积分、品牌 |
| 亮红 | `#FF4D42` | 积分数值/强调 |
| 主文字·白 | `#F2F2F2` | 标题正文 |
| 次文字 | `#A8A8A8` | 副信息 |
| 辅助文字 | `#6F6F6F` | 占位/时间 |
| 分割线 | `rgba(255,255,255,0.07)` | 边框/分隔 |

> 暗底设计：图标用**白色或红色**线条（深色图标在黑底看不见）；导出透明 PNG，3 倍图。
> 品牌素材：吉祥物 `logo.png`（全彩，暗底显示好）；字标 `字体png.png` 为黑+橙，**只适合白底**，暗底请用白色/描边版。
> 品牌素材：字标 `assets/logos/字体png.png`、吉祥物 `assets/logos/logo.png`（赛博浣熊）。

---

## P0 必须（不做没法上线）

### TabBar 图标（4 项 × 2 态 = 8 张）
- 路径：`assets/tab/`
- 尺寸：**81×81 px**，PNG 透明底
- 未选中：灰 `#9499A0` 线性；选中：粉 `#FB7299` 填充
- 文件：`home / redeem / code / me` 各 `xxx.png`（未选）+ `xxx-active.png`（选中）
- 图意：首页=房子 / 兑换=礼物盒或券 / 会员码=二维码 / 我的=人像

### 功能图标（SVG，走 icon 组件）
- 路径：`assets/icons/`，格式 **SVG**（颜色直接画进 SVG，暗底用白/红，组件不改色）
- 用法：`<icon name="redeem" size="72" />`（页面 json 里 usingComponents 引 `/components/icon/icon`）
- 需要的文件名（共 7 个）：
  `redeem`(兑换) `code`(会员码) `coupon`(优惠券) `sign`(签到) `activity`(活动/上新) `record`(兑换记录) `gift`(礼券)
- 没放之前显示浅红占位方块；放进去同名 `.svg` 即自动生效
- ⚠️ **tabBar 图标不能用 SVG/组件**，必须是 PNG（见下）

### 商品占位图
- 路径：`assets/placeholder/goods.png`
- 尺寸：**600×600 px**，浅灰底 `#F4F5F7` + 居中淡粉小图标，二次元感
- 用途：商品无实拍图时兜底

---

## P1 影响体验

### 首页轮播 Banner（3-5 张）
- 路径：`assets/banner/`
- 尺寸：**750×360 px**（2:1 略高），JPG/PNG
- 风格：二次元主视觉，粉/蓝渐变背景 + 大标题文案（新品入会 / 模玩节双倍积分 / 新品到货）
- AI 提示词参考：`anime style promotional banner, cute mascot, pink and blue gradient, Japanese kawaii, model toy shop, clean, high quality`

### 会员等级徽章（4 枚）
- 路径：`assets/badge/`
- 尺寸：**120×120 px**，PNG 透明
- 普通/白银/黄金/钻石，二次元勋章风，主色分别灰/银/金/蓝

### 品牌 Logo / 字标
- `assets/logo.png`（144×144）小程序图标
- `assets/wordmark.png`（透明，约 300×120）首页顶部"是模玩店！"字标，二次元手写感 + 粉色

### 空状态插画（1-2 张）
- 路径：`assets/placeholder/empty.png`
- 尺寸：**400×400 px**，PNG 透明
- 二次元小吉祥物 + "空空如也"感，粉蓝配色

---

## P2 锦上添花
- 吉祥物角色（首页/会员卡装饰）：`assets/mascot.png`，二次元猫耳店员形象（呼应原概念图）
- 积分/金币动效图标、签到日历图、等级进度装饰
- 兑换成功/核销成功的二次元小贴纸

---

## 命名与导出规范
- 全小写，连字符分词：`points-card-bg.png`
- 统一导出 **3 倍图**（@3x），小程序按 rpx 自适应
- 透明图一律 PNG；大图照片用 JPG 控体积（单图建议 < 150KB）
- 加好图后：在对应 wxml 把占位色块换成 `<image src="/assets/...">`，并在 `app.json` tabBar 补回 iconPath

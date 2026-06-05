# SIZE_DEBUG.md — 尺寸/布局排查记录

> 目的：记录"模拟器正常、真机翻车"的布局坑，以及全项目排查结论。
> 这类问题模拟器宽松不暴露，**必须真机验证**。

## 高风险模式速查（写样式时避开）
| 模式 | 为什么坑 | 正确做法 |
|---|---|---|
| `width: calc(50% - Xrpx)` 两列**正好凑满 100%** | 真机 rpx→px 亚像素四舍五入会超 1px → 换行成单列 | 留余量：`calc(50% - 14rpx)`（gap 20rpx 时），让两列 + 间距 < 100% |
| `inset: 0` 简写 | 旧基础库/真机可能不认 → 定位失效 | 写全 `top/right/bottom/left: 0` |
| `padding: a b calc(c + env(...))` 把 env()/constant() 放进**简写** | 整条 padding 声明可能被判无效作废 → 内边距全丢、贴边 | 安全区单独写：`padding: a b;` 再 `padding-bottom: calc(c + env(...));` |
| `constant(safe-area-inset-bottom)` | 旧 iOS 语法，微信解析器不认，使整条声明作废 | 只用 `env(safe-area-inset-bottom)`，且别放进简写 |
| 横滑容器(`overflow-x:auto`)的子项没 `flex-shrink:0` | 子项被压扁、滑不动 | 子项一律加 `flex-shrink: 0` |
| 固定 `px` 单位 | 不随屏幕缩放 | 一律用 `rpx`（750rpx = 屏宽） |
| 内容被 `position:fixed` 的 tabBar/底栏盖住 | 固定元素浮在内容上 | 页面 `.page` 底部留白 ≥ 固定栏高度 + 安全区 |

## 本次全项目审计（2026-06-04）

### 发现并修复
1. **[真机单列] 商品两列网格凑满 100%**
   - 位置：`index/redeem/search` 三处商品网格 `width: calc(50% - 10rpx)` + `gap: 20rpx`，两列正好 100%。
   - 现象：真机 iOS 掉成单列、右侧大片空白；模拟器正常。
   - 修复：改 `calc(50% - 14rpx)`，留约 4px 余量，稳定两列。
2. **[遮罩可能不铺满] admin 弹层 `.mask { inset: 0 }`**
   - 修复：改写全 `top/right/bottom/left: 0`。
3. **[底栏内边距可能丢失] goods-detail `.bottombar` padding 简写含 env()**
   - 修复：横向 padding 与 `padding-bottom: calc(... env())` 拆开写。

### 已确认安全
- 全局 `view, text { box-sizing: border-box }` 已生效 → border/padding 不会撑破 width。
- 横滑容器（goods-update `.tabs`、redeem `.cats`）子项均有 `flex-shrink: 0`。
- 全项目**无写死 px**，单位都是 rpx。
- 4 个 tab 页 `.page` 底部留白 **250rpx** ≥ tabBar(160rpx)+安全区(~68rpx)=228rpx，内容不被盖。
- `vh` 仅用于 `.page { min-height:100vh }` 与 admin 弹层 `max-height:82vh`，无副作用。
- `env(safe-area-inset-bottom)` 用在 custom-tab-bar、admin、goods-detail，均为独立 `padding-bottom`，安全。

### 低风险（已知，暂不处理）
- flexbox `gap`（18 处）：基础库 2.x+ 支持，绝大多数设备 OK；极旧设备无 gap 会让间距消失但不影响两列（网格宽度已留余量兜底）。
- admin 浮动按钮 `.fab { bottom: 60rpx }` 未叠加安全区：admin 非 tab 页、按钮在右下，影响极小。

## 真机自查清单（每次大改样式后过一遍）
- [ ] 商品/卡片**多列**：真机是否仍为预期列数（不掉单列）？
- [ ] 底部固定栏（tabBar/兑换栏/保存按钮）：内容能否完整露出、按钮不贴边、不被遮挡？
- [ ] 弹层/遮罩：是否铺满全屏、可滚动、保存按钮可见？
- [ ] 横向滚动条：标签是否完整不被压扁？
- [ ] iPhone 带「小白条」机型：底部内容是否被 Home Indicator 压住（需 env 安全区）？
- [ ] 长文案：是否溢出/截断异常？

## 规范
1. 单位一律 `rpx`；多列宽度 `calc(50% - N)` 的 N 要给够余量（别凑满 100%）。
2. 安全区 `env(...)` 只单独用在 `padding-bottom`/`bottom`，不进简写。
3. 不用 `inset`、`constant()` 等兼容性不稳的写法。
4. 横滑子项加 `flex-shrink:0`；固定底栏对应页面留足底部 padding。
5. **改完样式必须真机验证**，模拟器过了不算数。

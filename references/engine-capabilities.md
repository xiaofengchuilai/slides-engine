# 组件完整语法手册（slides-engine）

本文是 `.slide` 组件的权威语法参考。数值单位是**设计 px**（引擎内部 ×0.75 转 pt）。颜色支持 `#RRGGBB` / `#RGB` / 语义色。

## 通用规则

- 每个 `.slide` 文件最后一个表达式必须是 `<Slide>`。
- 禁用 React 概念：`import`/`export`/`module`/hooks/`useState`/函数组件定义。
- 组件 props 用对象字面量 `{...}`，字符串用单引号或双引号。
- 富文本：`<Text>` 内可用 `<span style={{...}}>` 内联（加粗/变色/下划线）。
- **全篇禁止使用 emoji**（图标用 FAIcon，文字用 Text，不要用 emoji 代替图标或装饰）。

### JS 表达式能力边界（重要）

`.slide` 经 SWC 编译后由 vm 沙箱执行，**允许使用普通 JS 表达式**，但需注意：

**可用（推荐）**：
- `.map()` / `.filter()` 等数组方法（如 `items.map((x, i) => <Box key={i}>...`)）
- 三元表达式 `cond ? <A/> : <B/>`
- `const` / `let` 局部变量定义
- 模板字符串、字符串拼接

**禁用（会被拦截或出错）**：
- `import` / `export` / `module`（validate 直接报 error）
- hooks / `useState` / 函数组件定义
- 异步 `await` / `Promise`（沙箱不注入）

**注意**：
- `.map()` 等表达式里若含富文本，必须用 Fragment `<>...</>` 包裹（见 component-text.md 的「map 中使用富文本」示例）。
- 表达式的**执行是同步的**，不要依赖副作用或异步行为。
- 不确定某个 JS 语法是否可用时，**优先显式展开**（如把 8 个 chevron 手动写成 8 个 `<Shape>`），而非依赖 `.map()` 的隐式行为——显式写法最稳、可读性最好、不踩沙箱边界。

### 可读性硬门禁（颜色对比度，validate 强制校验，2026-09-08 新增）

**任何文字必须与它所在背景（Slide/Box 的 background）对比清晰，禁止同色系叠字**（浅底配浅字 / 深底配深字 = validate error，无法通过）：

- **优先用语义 token 配色**（引擎主题自动保证深底浅字/浅底深字）：文字用 `text` / `muted` / `primary`（配浅底），深底上才用 `#FFFFFF` 系亮字。少写裸 hex，写 hex 前想清它跟背景的关系。
- validate 已按字号分级校验：**<18px 正文/标签对比度须 ≥4.5:1；18-32px 中字 ≥3:1；≥32px 大标题/大数字 ≥2:1**。低于即 error（accent 作 ≥18px 强调字降 warning 提示，不阻断）。
- **accent 语义=强调装饰色**：白底上作小字正文会对比不足（约 2:1）——accent 只用于大字锚点/图形填充/深底反白，正文/标签字用 `text`/`muted`。
- **渐变背景（`linear-gradient(...)`）上写字默认按深底处理**：要用白字请同时加 `rgba(0,0,0,0.4)` 蒙版（见 design-principle），或确认渐变最浅端仍够深；纯渐变上写浅字 validate 无法自动判（背景解析不出），靠动笔自检把关。

## Slide（根容器）

每页唯一，包住整页内容。画布固定 1280×720（16:9）。

```jsx
<Slide>
  <Box>...</Box>
</Slide>
```

**高度约束（强制，写 .slide 前必须算清）**：
- Slide 高度固定 720px，内容**绝对不允许溢出**画布
- 写代码前必须计算总高度：`上padding + 标题区高度 + 内容区高度 + 各间距(gap/margin) + 下padding ≤ 720px`
- 禁止在主内容区用 `flex:1` 且不计算实际高度
- 优先用精确计算的固定值或百分比

**安全区域（强制）**：
- Slide 的 `padding` 是页面安全区，**必须保留**，不能用绝对定位绕过
- 内容区可用高度 = `720px - 上padding - 下padding`
- 所有内容必须在安全区内

**布局验证清单（每页生成前检查）**：
1. 已计算总高度 ≤720px
2. padding 安全区已保留（未被绝对定位绕过）
3. 内容区高度已验证
4. 固定高度元素不会溢出
5. 背景装饰可用绝对定位，但不占用安全区
6. 每个视觉区块应有独立容器 Box，并加背景（纯色/半透明）增强分区感

## Box（布局容器）

继承 CSS flexbox 子集。常用 props（都在 `style` 里）：

| 属性 | 类型 | 说明 |
|---|---|---|
| `flexDirection` | `'row'`/`'column'` | 主轴方向，默认 column |
| `justifyContent` | `'center'`/`'space-between'`/`'space-around'`/`'space-evenly'`/`'flex-start'`/`'flex-end'` | 主轴对齐 |
| `alignItems` | `'center'`/`'flex-start'`/`'flex-end'`/`'stretch'` | 交叉轴对齐 |
| `alignSelf` | `'auto'`/`'center'`/`'flex-start'`/`'flex-end'`/`'stretch'`/`'baseline'` | 单子元素交叉轴对齐（覆盖父 alignItems） |
| `flexWrap` | `'nowrap'`/`'wrap'`/`'wrap-reverse'` | 换行模式，默认 nowrap |
| `gap` | number | 子元素间距 px |
| `padding` | number 或 string | 内边距：数字=四边同值；字符串支持 `'10px'` / `'10px 16px'` / `'10px 16px 20px 24px'` |
| `margin` | number 或 string | 外边距，同上支持数字/字符串简写 |
| `background` | 颜色或渐变 | 背景色（支持语义色）+ 渐变 `'linear-gradient(135deg, ...)'` |
| `border` | string | 边框 `'1px solid #D6DCE5'` |
| `borderRadius` | number | 圆角 px |
| `boxShadow` | string | 外阴影 `'2px 2px 8px rgba(0,0,0,0.3)'` |
| `opacity` | number(0-1) | 不透明度（0 全透明，1 全不透明） |
| `flex` | number | 弹性占比（多卡均分用 `flex: 1`） |
| `minWidth`/`minHeight`/`maxWidth`/`maxHeight` | number | 尺寸约束 |
| `width`/`height` | number | 固定宽高 px |

> **不支持**：`display: 'grid'` / `grid*` 属性（仅支持 flex）；`zIndex`（yoga 与 pptxgenjs 无原生 z-index，本轮未实现）；CSS `calc()`。

```jsx
<Box style={{ flexDirection: 'row', gap: 16, padding: 24 }}>
  <Box style={{ flex: 1, background: 'light', borderRadius: 12 }}>...</Box>
  <Box style={{ flex: 1, background: '#FFFFFF', borderRadius: 12 }}>...</Box>
</Box>
```

## Text（文本）

| 属性 | 类型 | 说明 |
|---|---|---|
| `fontSize` | number | 设计 px（引擎 ×0.75 转 pt） |
| `color` | 颜色 | 文本色（语义色或 hex）；**必须与所在背景对比清晰**（正文 ≥4.5:1，validate 会校验）——浅底用 `text`/`muted`/深 hex，深底才用白/亮色，禁同色系叠字 |
| `bold` | boolean | 加粗 |
| `fontWeight` | `'bold'` 或 number(100-900) | 加粗；数值 ≥600 降级为 bold（pptxgenjs 无原生数值字重，只能两档） |
| `lineHeight` | number | 行高（默认 1.0） |
| `textAlign` | `'left'`/`'center'`/`'right'` | 对齐 |
| `letterSpacing` | number | 字间距 px |
| `textShadow` | string | 文字阴影 `'2px 2px 8px rgba(0,0,0,0.3)'` |
| `textDecoration` | `'underline'`/`'line-through'` | 下划线 / 删除线 |
| `opacity` | number(0-1) | 不透明度（0 全透明，1 全不透明） |
| `href` | string | 超链接（整段 Text，props 顶层不是 style） |

> **不支持**：`fontWeight` 数值只降级到两档（bold/regular），无法精确到 300/500/700 等中间字重；`whiteSpace`/`overflow`/`textOverflow` 未实现（引擎已做自动折行）。

富文本内联 + 换行：

```jsx
<Text style={{ fontSize: 16, color: 'muted' }}>
  这是 <span style={{ fontWeight: 'bold' }}>加粗</span> 和
  <span style={{ color: 'accent' }}>变色</span> 的文字。
  <br />
  第二行内容
</Text>
```

超链接（整段，段内 span 不支持）：

```jsx
<Text href="https://example.com" style={{ color: '#2563EB', textDecoration: 'underline' }}>
  示例链接
</Text>
```

> **换行**用 `<br />`（不用 `\n`）；**局部样式**用 `<span>`；**不支持** `<strong>`/`<em>`/`<u>`。

## Image（图片）

| 属性 | 类型 | 说明 |
|---|---|---|
| `src` | string | 图片路径，**相对 slide 文件所在目录** |
| `width`/`height` | number | 尺寸 px |
| `objectFit` | `'cover'`/`'contain'` | 裁切填满 / 完整显示 |

> 目录模式（slides/ + assets/ 兄弟目录）引用 assets 用 `../assets/xxx.png`。

```jsx
<Image src="../assets/hero.png" style={{ width: 640, height: 480 }} />
<Image src="../assets/avatar.png" style={{ width: 300, height: 300, objectFit: 'cover' }} />
```

## RoughBox（手绘图形）

手绘风图形（rough.js），渲染为 PNG 位图。`shape` 决定形状，视觉参数在 style。

| 属性 | 类型 | 说明 |
|---|---|---|
| `shape` | `'rect'`/`'circle'`/`'ellipse'`/`'path'`/`'line'`/`'polygon'`/`'curve'`/`'linearPath'` | 形状 |
| `path` | string | shape=path 时的 SVG path（如 `"M 0 20 L 0 60"`） |
| `points` | array | shape=line/polygon/curve 时的点数组 |
| `style.width/height` | number | 尺寸 px |
| `style.stroke` | string | 描边色（`#RRGGBB`） |
| `style.strokeWidth` | number | 描边粗细（默认 2） |
| `style.roughness` | number | 手绘强度（默认 1.5，越大越抖） |
| `style.fill` | string | 填充色；`'none'` = 空心 |
| `style.fillStyle` | `'hachure'`/`'solid'`/`'dashed'`/`'zigzag'`/`'dots'` | 填充纹理 |
| `style.dash` | array | 虚线（如 `[8,6]`，仅 stroke，非填充纹理） |
| `style.opacity` | number | 透明度 0-1 |

**⚠️ RoughBox 配套文本的硬性规范（踩坑总结，必须遵守）**：
1. **RoughBox 与文本同容器时，容器必须显式 `width`**（与 RoughBox 一致）——否则文本容器被 flex 拉伸到父宽，文本溢出手绘框（实测 P6/P10 右下文本超出 520 框）。
2. 推荐结构：外层 Box `width: <框宽>` → RoughBox `position:'absolute', left:0, top:0` + 文本 Box `position:'relative', width:<框宽>`。
3. RoughBox 是 `position:'absolute'` 时不占 flex 流，文本 Box 若 `position:'relative'` 会撑满容器——**必须用 width 约束**。
4. 纯装饰 RoughBox（无配套文本）可自由 absolute 定位，不受此限。

### ⚠️ absolute 容器内文字宽度硬规则（2026-09-04 教训，防横溢）

**`position:'absolute'` 容器内的文字/子 Box，禁止用 `flex:1`/`flexGrow` + `maxWidth` 约束宽度**——引擎对 absolute 容器内 flex 子项宽度计算失效（布局宽算成 0），Text 不会折行、整句横向无限延伸溢出容器（实例：整改闭环结构图节点说明文字横溢到右栏，2026-09-04 P9）。

- ❌ 反例：`<Box position:'absolute' left:44><Box style={{ flex: 1, maxWidth: 470 }}><Text>长文本…</Text></Box></Box>` → Text 宽=0 不折行，横向溢出
- ✅ 正确：absolute 容器内的文字容器**一律显式 `width: <px>`**（如 `width: 430, flexShrink: 0`），让 Yoga 有确定宽度可折行
- 判断：absolute 定位只用于**单个装饰元素或整块定位容器**；容器内要排多列/长文本，要么给容器显式 width，要么改用非 absolute 的 flex 布局。

### ⚠️ 大字 + 小字禁止混排单 Text（2026-09-04 教训，防容器被撑高）

**同一 Text 内大字号 + 小字号 span 混排（如 `fontSize:130` 的"2" + `fontSize:34` 的 span"分钟"），若整行 intrinsic 宽超过容器宽，会被折成多行，而多行高度按最大字号（130px）行高累乘 → 容器撑高一倍、后续内容下移错位。**

- ❌ 反例：`<Text fontSize:130>2<span fontSize:34>分钟</span></Text>` 放 width:300 容器 → 折 2 行 × 156px = 312 高
- ✅ 正确：大字号与小字号拆成**独立 Text**，用 `flexDirection:'row', alignItems:'flex-end'` 底对齐摆放（视觉同行），且容器宽度**必须放得下大字整行**（大字全角字符数 × fontSize）
- 判断：任何「数字/字符为主的大字锚点 + 单位/注释小字」场景（如 80%、2 分钟、¥299），一律拆两 Text 底对齐，禁止 `大字<span 小字>` 混排；容器宽预留大字完整宽度。

### ⚠️ flex row 行容器在 alignItems:center 父列里会坍缩——必须显式 width（2026-09-04 教训，P12）

**`flexDirection:'row'` 的行容器（内含 flex:1 均分的多卡/多列），若它是 `alignItems:'center'`（或默认）的列布局的子元素且没设宽度，会被列布局按内容收缩 → 行宽 = 内容宽 → 卡内 flex:1 无剩余空间可分 → 多卡全部坍缩成内容宽、挤在中间一团，卡内 Text 也拿不到宽度。**

- ❌ 反例：列容器 `alignItems:'center'` 内直接放 `<Box flexDirection:'row'><Box flex:1>卡1</Box><Box flex:1>卡2</Box></Box>` → 行无宽，卡坍缩挤一团
- ✅ 正确：给行容器**显式 `width`**（撑满父内容区，如页面宽 1280 - 两侧 padding = 1040），行内 flex:1 才能均分剩余空间：`<Box flexDirection:'row', width:1040>`
- 判断：凡列布局内嵌 flex row 且 row 内有用 flex:1 均分的子元素，row 必须显式 width（= 父内容区宽）；整页用 absolute 定位的列布局同样适用。

### ⚠️ SVG 圆球结构图坐标铁律（2026-09-04 P6/P9/P10 三连错教训）

**「竖轴 + 圆球骑轴 + 节点文字」类结构图，SVG 内坐标与容器 absolute 坐标不能混用**：圆球 `cy` 是 SVG 画布坐标，圆球旁序号/文字的 `top` 是容器坐标——必须换算 `top = SVG的top + cy − 偏移`，否则整体错位（实测偏上 156px）。序号 left = `cx − 框宽/2` 居中于圆球；文字标题 `top = SVG_top + cy − 标题行高/2` 对齐圆球中心（勿随手减 50~84 猜偏移）；SVG 高度 ≥ max(cy)+r 防底部圆被裁；**内容节点圆球四边距 viewBox 边界 ≥8px**（贴 0 边界会被光栅化削边，P10 左截教训；满幅装饰大环 r≥短边40% 豁免）；文字块总高 < 圆球间距防压下一段。**推荐写法：圆球用 `<Box borderRadius:999 border>` 画（与序号/文字同坐标系），不用 SVG**。完整规范见 component-svg.md「时间轴/圆球结构图坐标硬规则」。

```jsx
{/* 正确：框和文本同宽，文本不溢出 */}
<Box style={{ position: 'relative', marginTop: 36, width: 520 }}>
  <RoughBox shape="rect" style={{ width: 520, height: 84, stroke: '#7A8B99', position: 'absolute', left: 0, top: 0 }} />
  <Text style={{ fontSize: 20, padding: 20, position: 'relative', width: 520 }}>正文文本…</Text>
</Box>
```

## Emoji（彩色 emoji）

彩色 emoji 图标（Twemoji 本地 PNG，离线可用）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `name` | string | emoji 字符（如 `💰`） |
| `style.width/height` | number | 尺寸 px |

```jsx
<Emoji name="💰" style={{ width: 48, height: 48 }} />
```

> 文本装饰符号（♔★✓♪❦ 等非彩色 emoji）Twemoji 不收录，保持 Text 渲染。

## FAIcon（图标）

Font Awesome 矢量图标，引擎内部 SVG→PNG 渲染。`name` 必须是 Font Awesome 存在的图标名（禁止编造）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `name` | string | 图标名，如 `heart`/`chart-line`/`rocket`/`check-circle` |
| `fill` | 颜色 | 填充色（必填，默认透明不可见） |
| `width`/`height` | number | 尺寸 px，默认 24 |

```jsx
<FAIcon name='chart-line' style={{ fill: '#3b82f6', width: 32, height: 32 }} />
```

常用图标：`home`/`user`/`users`/`heart`/`star`/`check`/`check-circle`/`times`/`plus`/`arrow-right`/`arrow-left`/`arrow-up`/`arrow-down`/`briefcase`/`chart-line`/`chart-bar`/`dollar`/`calendar`/`clock`/`lock`/`shield`/`cog`/`rocket`/`envelope`/`phone`/`comment`/`share`。

## Table（表格）

| 属性 | 类型 | 说明 |
|---|---|---|
| `style.width`/`style.height` | number | 表格尺寸（建议必填） |
| `cells` | 二维数组 | 单元格，元素是字符串或 `{text, textStyle, cellStyle}` |

单元格对象：
- `text`：文本
- `textStyle`：`{bold, color, fontSize}` 文本样式
- `cellStyle`：`{background: {color}}` 背景色（斑马纹靠手动给交替行上色）

```jsx
<Table
  style={{ width: 900, height: 320 }}
  cells={[
    [
      { text: '功能', textStyle: { bold: true, color: '#FFFFFF' }, cellStyle: { background: { color: '#1E3A8A' } } },
      { text: '基础版', textStyle: { bold: true, color: '#FFFFFF' }, cellStyle: { background: { color: '#1E3A8A' } } },
    ],
    ['用户数', '10人'],
    [
      { text: '存储', cellStyle: { background: { color: '#E8EDF3' } } },
      { text: '5GB', cellStyle: { background: { color: '#E8EDF3' } } },
    ],
  ]}
/>
```

> 斑马纹：给偶数数据行统一加浅灰 `cellStyle.background`（建议 `#E8EDF3`，比 `#F8FAFC` 更明显）。

## Shape（预设形状 + 连接线）

用于结构图（战略房屋/矩阵/瀑布/价值链等）的几何形状。`type` 是 pptxgenjs 的 ShapeType 键（200+ 种）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `type` | string | 形状名，见下方常用清单 |
| `style.fill` | 颜色 | 填充色 |
| `style.line` | 对象 | 描边/连接线：`{color, width, dashType, endArrowType, beginArrowType}` |
| `style.borderRadius` | number | 圆角矩形半径（roundRect） |
| `style.rotate` | number | 旋转角度（-360~360） |

常用形状：`rect`（矩形）/ `roundRect`（圆角矩形）/ `ellipse`（椭圆）/ `triangle`（三角形）/ `diamond`（菱形）/ `chevron`（箭头形）/ `pentagon` / `hexagon` / `parallelogram`（平行四边形）/ `trapezoid`（梯形）/ `line`（线）/ `rightArrow` / `leftArrow` / `upArrow` / `downArrow` / `heart` / `star5` / `funnel` / `homePlate` / `flowChart*`（流程图全套）。

```jsx
{/* 箭头形（价值链节点） */}
<Shape type="chevron" style={{ width: 120, height: 48, fill: 'primary' }} />

{/* 菱形（决策节点） */}
<Shape type="diamond" style={{ width: 60, height: 60, fill: 'accent' }} />

{/* 连接线 + 箭头 */}
<Shape type="line" style={{ width: 100, height: 0, line: { color: 'primary', width: 2, endArrowType: 'triangle' } }} />
```

> **结构图关键**：用 Shape 画几何骨架（矩形/三角形/chevron/箭头/连接线）+ 独立 Text 层放文字（文图分离，文字可编辑）。战略房屋 = 三角形屋顶 + 矩形横梁/柱/地基；价值链 = chevron 横排；矩阵 = 矩形 + 线。**不需要 custGeom**（pptxgenjs 的 custGeom 有 bug，但预设形状已覆盖 90% 结构图需求）。样例见 `examples/house.slide`。

> **连接线方向（重要）**：`ShapeType.line` 是**横向**预设形状——`width` 是线长、`height` 应设 0。画**横向线**用 `<Shape type="line" style={{ width: 100, height: 0 }} />`（如上示例）。
> 画**垂直竖线**有两种正确方式：
> 1. **细长矩形（推荐，最稳）**：`<Shape type="rect" style={{ width: 2, height: 80, fill: 'primary' }} />`——用 2px 宽的矩形当竖线，无旋转边界问题。
> 2. 显式 `rotate: 90`（`<Shape type="line" style={{ width: 80, height: 0, rotate: 90 }} />`），但旋转绕中心、坐标需额外校准，不推荐常规使用。
> **禁止**用 `width: 0, height: 80` 试图画竖线——那会得到一条横向线（line 是横向形状，且 width=0 在旧版会被父容器 stretch 成全宽；现已修复为保持 0 宽，但方向仍是横向）。

## SVG（内联矢量图）

直接写内联 `<svg>` 标签渲染自定义矢量图（复杂路径、装饰图形等）。引擎内部转 PNG 位图（绕开 svgBlip 兼容）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `width`/`height` | number | 尺寸 px（必填，在标签顶层不是 style） |
| `viewBox` | string | 坐标系（**保持驼峰，勿写成 view-box**） |
| 子元素 | — | `<rect>`/`<circle>`/`<path>`/`<g>`/`<line>`/`<polygon>` 等 |

```jsx
<svg width={100} height={100} viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#3b82f6" />
</svg>
```

> SVG 属性 camelCase→kebab 自动转换（strokeWidth→stroke-width），但 viewBox/preserveAspectRatio 等 SVG 保留属性保持驼峰。**注意**：SVG 内文字会烤进 PNG 不可编辑，结构图主体文字应走独立 Text 层，SVG 只用于纯图形/装饰。

> **布局机制（重要）**：`<svg>` 根节点参与页面布局（决定图的位置和尺寸，通过 width/height）；`<svg>` **内部的图形元素**（`g`/`line`/`circle`/`rect`/`path`/`polygon`/`ellipse`）**不参与 flex 布局**，它们只在 SVG 自己的 `viewBox` 坐标系里绘制图形。所以内部元素的坐标用 `cx/cy/x1/y1/d` 这种 SVG 绝对坐标写，不要写成 flex 子节点。引擎已修复：复杂 SVG（g 分组 + 多图形）不会触发假溢出误报。

## QRCode（二维码）

把文本转成二维码图片（qrcode 库生成 SVG → PNG 位图）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `text` | string | 二维码内容（真实可访问链接） |
| `style.width` | number | 边长 px，默认 240（高自动等于宽） |

```jsx
<QRCode text="https://example.com" style={{ width: 160 }} />
```

> 二维码旁应配说明文案，明确扫码后的用途。

## Chart（图表）

| 属性 | 类型 | 说明 |
|---|---|---|
| `chartType` | string | `barChart`/`bar3dChart`/`lineChart`/`areaChart`/`pieChart`/`doughnutChart`/`radarChart`/`scatterChart`/`bubbleChart` |
| `data` | 二维数组 | 第1行表头（类别+系列名），后续行数据（数值必须 number） |
| `title` | string | 图表标题 |
| `colors` | string[] | 系列配色 |
| `showLegend` | boolean | 是否显示图例（默认 true，引擎已处理） |
| `showDataLabels` | boolean | 是否显示数据标签（默认 false） |
| `barDirection` | `'bar'`/`'column'` | 柱状方向（仅 barChart） |

```jsx
<Chart
  style={{ width: 900, height: 420 }}
  chartType='barChart'
  title='季度销售对比'
  showLegend={true}
  showDataLabels={true}
  colors={['#3b82f6', '#f59e0b']}
  data={[
    ['季度', '2025', '2026'],
    ['Q1', 120, 145],
    ['Q2', 156, 178],
  ]}
/>
```

> 饼图/圆环仅支持单系列（两列：类别+数值）。

## 组件库（components.mjs 预设）

| 组件 | props | 说明 |
|---|---|---|
| `KpiCard` | `number`/`label`/`desc` | 指标卡（大数字+标签+说明） |
| `Cover` | `title`/`subtitle`/`author` | 封面 |
| `TOC` | `items`（字符串数组） | 目录 |
| `Footer` | `page`/`total`/`label` | 页脚（页码） |

```jsx
<KpiCard number="2.8亿" label="年度营收" desc="同比增长 35%" />
<Cover title="产品发布会" subtitle="2026 年度" author="产品团队" />
<TOC items={['产品定位', '数据亮点', '未来规划']} />
<Footer page="3" total="7" />
```

> 注意：这些是引擎自定义组件库，通用排版引擎通常不提供；做兼容性对比时用基础组件（Box/Text/FAIcon/Table/Chart）。

## 组件能力边界（生成前必读）

**已实现（可直接用）**：

| 组件/能力 | 说明 |
|---|---|
| Box / Text / Image / FAIcon / Table / Chart / Shape / SVG / QRCode | 全部支持 |
| Text 富文本 + `<br/>` + 对齐 + 字间距 + 阴影 + 超链接 + 删除线 | 支持 |
| Image objectFit（cover/contain） | 支持 |
| **Box flex 布局增强** | 支持：`flexWrap` / `alignSelf` / `minWidth` / `minHeight` / `maxWidth` / `maxHeight` / 字符串 `padding`+`margin` 简写 |
| **Box 视觉增强** | 支持：`boxShadow`（标准外阴影）/ `opacity` / `border` |
| **Text 视觉增强** | 支持：`opacity` / `fontWeight` 数值（≥600→bold）/ `textDecoration: line-through` |
| **渐变背景**（Box background 渐变） | 支持：`background: 'linear-gradient(135deg, #431407 0%, #F59E0B 100%)'` |
| **Slide 背景** | 支持纯色（`<Slide style={{ background: '#1E3A8A' }}>`）；渐变**降级为首个停靠点纯色**（pptxgenjs slide.background 仅支持 solid，渐变请用 Slide 内层全屏 Box 实现） |
| **颜色解析** | 支持 `#hex` / `#hex3` / `rgb()` / `rgba()`（rgba 的 alpha 丢弃，透明请用 `opacity` 单独表达） |
| **Fragment `<>...</>`** | 支持：`.map()` 中可用 Fragment 包裹多节点，会平铺进父容器 |
| **渐变文字**（Text backgroundImage + backgroundClip） | 支持：`backgroundImage: 'linear-gradient(...)', backgroundClip: 'text', color: 'transparent'` |
| **Math**（LaTeX 公式） | 支持：`<Math latex="E=mc^2" width={200} color="#000" />`（MathJax） |
| **CodeBlock**（语法高亮代码块） | 支持：`<CodeBlock code="..." language="javascript" width={700} />`（shiki，theme github-dark/light） |
| **clipPath**（图片圆形/椭圆裁剪） | 支持：`<Image style={{ clipPath: 'circle(50%)' }} />`（circle/ellipse） |

**暂不支持（生成时禁用，否则报错或空白）**：

| 能力 | 说明 | 原因 |
|---|---|---|
| **Animation（动画）** | ❌ **明确不做** | 见下方专项说明 |
| **zIndex** | ❌ 不支持 | yoga 与 pptxgenjs 无原生 z-index，本轮未实现（靠输出顺序决定层级） |
| **display: 'grid'** / `grid*` 属性 | ❌ 不支持 | 引擎仅支持 flex 布局 |
| **CSS `calc()`** | ❌ 不支持 | 用 `flex: 1` / 百分比 / 固定值替代 |
| **fontWeight 精确字重** | ⚠️ 降级 | 数值 100-900 只降级为 bold(≥600)/regular 两档 |
| **Text `whiteSpace`/`overflow`/`textOverflow`** | ❌ 不支持 | 引擎已做自动折行（wrapText） |

**Animation 专项说明（为什么不做）**：
1. **价值为零**：动画是"放映时"效果，静态 PPT 观感对比完全无关（专业演示排版通常不使用动画）。
2. **无干净可靠的现成方案**：
   - pptxgenjs（我们引擎依赖）**官方不支持动画 API**；
   - python-pptx **不支持动画**；
   - Aspose.Slides-FOSS（MIT）动画 API 有 bug——实测 fade 能打开，fly/zoom/spin 生成的 timing XML 不完整导致 PowerPoint **无法打开**；
   - svg2ooxml（动画 oracle 实测可靠）但 **AGPL-3.0 协议**，有传染性与商用限制，与本项目 MIT 许可不兼容；
   - Spire/Aspose 商业库：付费。
3. **成本最高**：要自写 OOXML `<p:timing>` 时序树 + 几十种 animEffect 预设 ID 映射，且 PowerPoint 会"静默丢弃"看起来对但不播的 XML。

**结论**：Animation 明确不做。遇到用户要求动画时，**如实告知"当前引擎不支持动画"**，不要尝试用假 XML 糊弄（会导致 PowerPoint 无法打开）。

**生成规则**：写 `.slide` 前确认用到的组件都在"已实现"清单里；遇到动画需求明确告知用户暂不支持。

## 语义色 token（按主题）

**6 主题 × 18 token 统一契约**（2026-09-11 建立）：任何主题都可互换，`resolveColor` 不再静默兑底成 `text` 色。
写 `.slide` 时直接用语义 token（如 `background: 'deep'`），跨主题换肤才会自动生效。

| token | `business` | `tech` | `culture` | `academic` | `consulting` | `redgold` |
|---|---|---|---|---|---|---|
| `primary` | #1E3A8A | #3B82F6 | #1A1A1A | #1E4FA8 | #061F32 | #E63F26 |
| `secondary` | #3B82F6 | #06B6D4 | #A8351A | #3D7BD9 | #001965 | #C42819 |
| `accent` | #F59E0B | #F97316 | #A8351A | #FFC107 | #08A6F6 | #E19825 |
| `bg` | #FFFFFF | #0F172A | #F7F4EC | #FFFFFF | #FFFFFF | #FFFFFF |
| `text` | #0F172A | #F7F4EC | #3F4A55 | #1A2230 | #1A1A1A | #171616 |
| `muted` | #64748B | #94A3B8 | #8A8A8A | #8B97A8 | #808080 | #9CA3AF |
| `cardBg` | #F5F7FA | #1E293B | #F3EFE6 | #F5F8FC | #F6F7F8 | #FBF7F0 |
| `danger` | #DC2626 | #EF4444 | #B91C1C | #D9534F | #5A0E13 | #B91C1C |
| `success` | #16A34A | #22C55E | #15803D | #2E7D32 | #177B57 | #16A34A |
| `warning` | #EA580C | #FB923C | #C2410C | #E67E22 | #F47B39 | #F59E0B |
| `line` | #E2E8F0 | #334155 | #E2DCD0 | #D6DCE5 | #E7E6E6 | #E5E7EB |
| `bgSoft` | #F8FAFC | #1E293B | #F0EBE0 | #F7F9FC | #FAFAFA | #FAF7F2 |
| `deep` | #132C5F | #020617 | #1A1A1A | #0E3F8C | #02121F | #A81810 |
| `light` | #DBEAFE | #1E40AF | #EFE9DC | #E8EFF8 | #99BDED | #F7DFC8 |
| `ink` | #334155 | #CBD5E1 | #5A6570 | #44546A | #44546A | #5C3A2E |
| `bright` | #60A5FA | #60A5FA | #C4502E | #5B9BD5 | #4FC3F7 | #EE5530 |
| `gold` | #FBBF24 | #FBBF24 | #B8860B | #FFC000 | #D4AF37 | #FFC000 |
| `goldLight` | #FDE68A | #FDE68A | #E8D5A3 | #FFE79B | #F0E0A8 | #FFE79B |

别名（各主题通用，无需出现在上表）：`textOnDark`/`white` → 深底反白亮色、`label`/`caption`/`subtle` → `muted`、
`surface` → `cardBg`、`background` → `bg`。

**⚠️ 新增主题或新增 token 的纪律**：必须给**全部 6 个主题**补同语义对应色，否则跨主题换肤时会被
`resolveColor` 静默兑底成 `text` 色（页面变灰、对比度崩）。同步三处：`theme.mjs` 的 `themes[].colors`、
`gradient.mjs` 的 `SEMANTIC_TOKENS` 白名单、app 的 `service/retint.js` 的 `THEME_PALETTES`（检测基准）。
回归测试：`node assets/tests/theme-contract.test.mjs`（7 项断言，改色不同步即失败）。

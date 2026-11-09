---
name: component-box
description: Box 容器组件规范 — Flex 布局、盒模型、常用样式属性、限制条款
---

# Box 组件规范

Box 是最基础的容器组件，承担所有**布局与分组**职责。支持 Flexbox 布局，可任意嵌套，是构建页面结构的基本单元。

## 默认布局

```jsx
<Box>...</Box>
// 等价于
<Box style={{ display: 'flex', flexDirection: 'column' }}>...</Box>
```

- 默认 `display: 'flex'`，`flexDirection: 'column'`（纵向流）
- 未指定 `width` / `height` 时，尺寸由子组件与父容器共同决定

## 盒模型

**遵循 `box-sizing: border-box`**：设置 `width` / `height` 时已包含 padding 和 border，内容可用空间 = `width/height - padding - border`。

例如：`<Box style={{ width: 400, padding: 20, border: '2px solid #333' }}>` 内部子组件可用宽度 = 400 − 20×2 − 2×2 = **356px**。

**⚠️ `height` 同理是总高（含 padding）**：`<Box style={{ height: 560, paddingTop: 100 }}>` 的内容区实际高度 = 560 − 100 = **460px**，不是 560。想"页面顶部留 100 再放 560 内容"是 content-box 直觉，在这里是错的——页边距应由外层 720 容器 padding 承担（见 component-slide.md「正文容器范式」），不要用"死高 + 内部 paddingTop"模拟。

**padding / margin 取值（引擎支持全形态）**：
- 数字：`padding: 20` → 四边均 20px
- CSS 简写字符串（1/2/3/4 值，与浏览器语义一致）：
  - `'20px'` → 四边 20
  - `'20px 40px'` → 上下 20、左右 40
  - `'20px 40px 10px'` → 上 20、左右 40、下 10（**三值合法，引擎支持**）
  - `'20px 40px 10px 0'` → 上 右 下 左
- 语义间距 token（见主题）：`'lg'` / `'lg xl'` / `'xl lg md'` 等同理
- 方向变体：`paddingTop` / `paddingBottom` / `paddingLeft` / `paddingRight`（及 margin 同名）单独设边
- 推荐：写 padding 时**带上下底**（如 `'80px 70 40px'`），不要省略 bottom（省略=0，内容易贴底）。

## 常用样式

| 类别 | 属性 |
| :--- | :--- |
| 布局 | `flexDirection` / `justifyContent` / `alignItems` / `gap` / `flex` / `flexWrap` |
| 尺寸 | `width` / `height` / `minWidth` / `minHeight` / `maxWidth` / `maxHeight` |
| 间距 | `padding` / `margin`（及其方向变体） |
| 视觉 | `background` / `border` / `borderRadius` / `boxShadow` / `opacity` |
| 定位 | `position: 'absolute' / 'relative'` / `top` / `left` / `right` / `bottom` / `zIndex` |

## 硬性限制（必须遵守）

1. **仅支持 `display: 'flex'`**。严禁 `display: 'grid'`、`display: 'table'` 以及任何 grid 相关属性（`gridTemplateColumns` 等）
2. **不支持 CSS `calc()` 函数**。需要动态尺寸时改用 `flex: 1` / 百分比 / 精确计算的固定值
3. 子组件类型可以是 `Text` / `FAIcon` / `Image` / `Chart` / `Table` / `Box`（嵌套）等任意组件

## 使用示例

### 横向排列（图标 + 文字组合）

```jsx
<Box style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 20,
    background: '#f0f4f8',
    borderRadius: 8,
}}>
    <FAIcon name='info-circle' style={{ fill: '#3b82f6', width: 24, height: 24 }} />
    <Box>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>标题</Text>
        <Text style={{ fontSize: 14, color: '#64748b' }}>描述文本</Text>
    </Box>
</Box>
```

### Flex 纵向均分（内容卡片组）

```jsx
<Box style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    height: '100%',
    justifyContent: 'space-between',
}}>
    <Box style={{ flex: 1 }}>...卡片 1...</Box>
    <Box style={{ flex: 1 }}>...卡片 2...</Box>
    <Box style={{ flex: 1 }}>...卡片 3...</Box>
</Box>
```

### 绝对定位装饰元素

```jsx
<Box style={{ position: 'relative', width: '100%', height: '100%' }}>
    {/* 背景装饰 */}
    <Box style={{
        position: 'absolute',
        top: 0, right: 0,
        width: 200, height: 200,
        background: 'linear-gradient(135deg, #3b82f6 0%, transparent 100%)',
        opacity: 0.1,
    }} />
    {/* 主内容 */}
    <Box style={{ position: 'relative', zIndex: 1 }}>...</Box>
</Box>
```

## 最佳实践

- 页面内**每个视觉区块**用独立的容器 Box 包裹，必要时加背景（纯色或半透明）增强分区感
- 卡片组用 **Flex + `flex: 1`** 均分空间，而非固定高度堆叠
- 布局、留白与信息密度规范见 [DESIGN.md](DESIGN.md)，具体项目以根目录 `DESIGN.md` 为准

## 扩展能力

- 容器超链接（`<Box href="...">`，含跳页 action）→ [component-hyperlink.md](component-hyperlink.md)
- 入场 / 退出 / 强调动画（`<Animation>` 包裹）→ [component-animation.md](component-animation.md)

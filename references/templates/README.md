# 模板库规范（templates/）

> slides-engine 的「可复用 .slide 模板库」——按页面类型 + 风格组织的模板集合，使用 .slide(JSX) 语法。
> 解决的核心问题：无图 PPT 的「高级感」靠现成版式骨架支撑，而不是 Agent 临场发挥。

## 目录结构

```
references/templates/
├── README.md              ← 本文件（规范）
├── template-library.md    ← 模板索引 + 匹配规则（Agent 选模板时读这个）
├── cover/                 ← 封面模板
├── toc/                   ← 目录模板
├── transition/            ← 章节转场模板
├── ending/                ← 结尾模板
└── content/               ← 内容页模板（按「内容结构 9 类型」）
```

## 三条铁律

### 1. 语义色（跨 6 主题通用）

模板**禁止写死 hex 颜色**，一律用语义色 token，这样同一套模板在 business/tech/culture/academic/consulting/redgold 六个主题下自动换肤：

| token | 用途 |
|---|---|
| `primary` | 主色（大色块、标题栏、锚点底） |
| `secondary` | 辅色（卡片、图表第二色） |
| `accent` | 强调色（编号块、关键数字、CTA） |
| `bg` | 背景 |
| `text` | 文本主色 |
| `muted` | 次要文本/说明 |
| `light` | 浅色底（卡片底/表头，仅 academic/consulting 有此 token，其他主题回退） |

> 例外：需要「深底浅字」的反差页（如封面/转场），允许用 `primary` 做背景 + 白字 `#FFFFFF`（这是有意的视觉反差，不是违例）。

### 2. 占位符语法

模板是「骨架 + 占位」，Agent 读模板后用真实内容替换占位：

- **文本占位**：写死示例文字 + `<!-- {{替换：xxx}} -->` 注释标注；
- **数量占位**：多条目用 `.map()` 或显式展开，注释标明「N 个条目，可增删」；
- **图片占位**：用 `<Image src="../assets/placeholder.png">` + 注释 `<!-- 无图则删除此元素，改色块/结构图 -->`。

Agent 使用模板的三步：
1. 读 `template-library.md` 按匹配规则选模板；
2. 读对应 `.slide` 模板文件；
3. 替换占位 → 填真实内容 → 按需增删条目 → validate。

### 3. 文图分离（强约束，沿用引擎既有规则）

结构图/流程图/矩阵的**形状骨架**用 Shape/SVG 画，**文字走独立 Text 层**。禁止把文字烤进 SVG/位图。

### 4. 属性白名单（引擎能力边界，写模板前必读）

模板只允许用 `engine-capabilities.md` 里**「已实现」清单**列出的 style 属性。已知禁区（写了会被 validate 报「静默忽略」或直接报错）：

- ❌ 单边 border：`borderBottom` / `borderTop` / `borderLeft` / `borderRight` —— 引擎只支持四边 `border`，单边会静默忽略。要画分隔线用 `<Shape type="line">` 或 2px 宽 `<Shape type="rect">`。
- ❌ `display: 'grid'` / `grid*` 属性（仅 flex）
- ❌ `zIndex`、CSS `calc()`
- ⚠️ `fontWeight` 数值只降级为 bold(≥600)/regular 两档
- ❌ Text 的 `whiteSpace`/`overflow`/`textOverflow`

**写完每个模板，必须跑一次 `node src/cli.mjs validate <模板.slide>`，确认 0 错误 0 警告（警告=有属性被静默忽略，必须修）。**

## 模板质量标准（每个模板必须满足）

- [ ] `validate` 通过（语法/资源/溢出不报错）
- [ ] 内容高度 ≤720px，padding 安全区保留
- [ ] 有 ≥1 个视觉锚点（大数字/大色块/结构图）
- [ ] 标题是完整结论句占位（不是名词）
- [ ] 元素丰富度 ≥4/6（圆角卡片/编号块/装饰线/颜色≥3层/结构化引导/主题标注）
- [ ] 语义色为主，无写死 hex（深底白字除外）

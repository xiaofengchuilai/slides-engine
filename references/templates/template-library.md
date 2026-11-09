# 模板库索引 + 匹配规则（template-library）

> Agent 选模板时**先读本文件**，按匹配规则选模板，再读对应 `.slide` 文件填内容。
> 匹配规则：3 级优先级匹配 + 内容结构 9 类型（已落地为 slides-engine 语法）。
> **库规模：678 个 .slide**（660 个既有模板整理 + 18 个原创通用模板），8 大页面类型 × 10 风格。

---

## 〇、目录结构

```
references/templates/
├── README.md              ← 模板书写规范（铁律/质量标准）
├── template-library.md    ← 本文件（索引 + 匹配规则）
├── TRANSLATION.md         ← 外部 .tpl → .slide 翻译规范
├── content/               ← 内容页（199 + 9 通用）
├── cover/                 ← 封面（143 + 3 通用）
├── toc/                   ← 目录（86 + 2 通用）
├── transition/            ← 转场（65 + 2 通用）
├── ending/                ← 结尾（110 + 2 通用）
├── decorative/            ← 装饰页（30）
├── functional/            ← 功能页（18）
└── title/                 ← 标题页（27）
```

---

## 一、页面类型 → 模板分组

| 页面类型 | 目录 | 模板数 | 说明 |
|---|---|---|---|
| cover 封面 | `cover/` | 146 | 全篇视觉最重，钩子开场 |
| toc 目录 | `toc/` | 88 | 章节导航 |
| transition 转场 | `transition/` | 67 | 章节切换，全篇统一用一个 |
| ending 结尾 | `ending/` | 112 | 结论回望 + CTA |
| content 内容 | `content/` | 208 | 按「内容结构 9 类型」分 |
| decorative 装饰 | `decorative/` | 30 | 过渡装饰/背景页 |
| functional 功能 | `functional/` | 18 | 议程/流程图/矩阵等专用 |
| title 标题 | `title/` | 27 | 章节副标题页 |

> 每个页面类型目录下还有 9-10 个**风格子目录**（见 §五），风格子目录内是编号 .slide；直接根目录下的 .slide 是原创通用模板（如 `content/argument.slide`）。

---

## 二、内容结构 9 类型（content 页的核心决策依据）

> 匹配规则：Content Structure by Page Type——每页先判断属于哪种「内容结构」，再选对应模板。

| # | 内容结构 | 适用 | 通用模板 |
|---|---|---|---|
| 1 | argument 论点 | 核心观点 + 3-4 论据 + 洞察 | `content/argument.slide` |
| 2 | data 数据 | 数据标题 + 4-6 指标 + 数据故事 | `content/data.slide` |
| 3 | process 流程 | 目标 + 4-6 步骤 + 成功指标 | `content/process.slide` |
| 4 | case 案例 | 背景 + 挑战 + 方案 + 结果 + 教训 | `content/case.slide` |
| 5 | comparison 对比 | 框架 + 选项 A/B/C + 建议 | `content/comparison.slide` |
| 6 | concept 概念 | 定义 + 3-5 组成 + 应用 + 误区 | `content/concept.slide` |
| 7 | problem 问题方案 | 问题 + 影响 + 根因 + 方案 | `content/problem.slide` |
| 8 | trend 趋势 | 基线 + 3-5 趋势 + 预测 + 行动 | `content/trend.slide` |
| 9 | summary 总结 | 执行摘要 + 4-6 要点 + 关键数字 + CTA | `content/summary.slide` |

---

## 三、匹配规则（3 优先级）

### 优先级 1：布局结构匹配（最重要）

| 页面特征 | 选型关键词 |
|---|---|
| 有图（图片是主角） | 选含 `Image` 的模板，图片占一侧 |
| 无图（文字/数据是主角） | 选纯结构图/卡片/列表模板（本库默认无图友好） |
| 数据冲击 | 选 `data` 结构（大数字锚点） |
| 流程/阶段/架构 | 选 `process` 结构（结构图，禁卡片横排） |

### 优先级 2：内容密度匹配

| 要点数 | 模板密度 |
|---|---|
| 1-2 点 | 大留白、居中、单锚点 |
| 3-4 点 | 标准、两栏、卡片组 |
| 5+ 点 | 密集、网格、多列 |

### 优先级 3：视觉多样性（强制）

- ❌ 同一 content 模板连续使用 = 违规
- ❌ 同一 content 模板全篇使用 >2 次 = 违规
- ✅ 相邻页版式不同，全篇非对称版式 ≥40%（沿用 story-principle 版式预算）

---

## 四、选模板流程（Agent 执行）

```
每页：
1. 判断页面类型（cover/toc/transition/ending/content/…）
2. 若是 content，判断「内容结构 9 类型」属于哪种
3. 按匹配规则 3 优先级选模板
4. 检查视觉多样性（同模板 ≤2 次、相邻不重复）
5. 读模板 .slide 文件 → 填内容 → validate
```

> **风格子目录的选法**：确定页面类型后，先按整篇基调选风格（business/tech/black-gold/cartoon/chinese/educational/flat/geometric/literary/minimalist/hand-drawn），再在对应子目录里按编号挑（编号越靠近说明版式越接近，可快速 open 几个对比）。

---

## 五、风格分布明细（按类型）

> 各风格子目录内为模板库编号 .slide；`通用` = 类型根目录下的原创模板。

| 类型 | 通用 | business | tech | black-gold | cartoon | chinese | educational | flat | geometric | literary | minimalist | hand-drawn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| content | 9 | 10 | 30 | 10 | 10 | 30 | 30 | 10 | 10 | 10 | 40 | — |
| cover | 3 | 15 | 16 | 18 | 18 | 18 | — | 18 | 3 | 8 | 18 | 8 |
| toc | 2 | 10 | 12 | 2 | 10 | 10 | — | 10 | 10 | 10 | 10 | — |
| transition | 2 | 7 | 7 | 7 | 7 | 7 | — | 7 | 7 | 7 | 7 | — |
| ending | 2 | 12 | 12 | 12 | 12 | 12 | — | 12 | 12 | 12 | 12 | — |
| decorative | — | 3 | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 | 3 | 3 |
| functional | — | 2 | 2 | 2 | 2 | 2 | — | 2 | 2 | 2 | 2 | — |
| title | — | — | 3 | 3 | 3 | 3 | — | 3 | 3 | 3 | 3 | 3 |
| **合计** | **18** | **59** | **85** | **57** | **65** | **85** | **30** | **65** | **50** | **55** | **95** | **14** |

> 校验：各风格合计 = 18+59+85+57+65+85+30+65+50+55+95+14 = 678 ✓

### 风格 → 主题映射（编译时 --theme 用）

| 风格 | 主题 | 说明 |
|---|---|---|
| tech | `tech` | 深色科技 |
| black-gold | `redgold` | 黑金 |
| chinese / literary | `culture` | 文化 |
| educational | `academic` | 学术 |
| 其他（business/cartoon/flat/geometric/minimalist/hand-drawn） | `business` | 默认浅色 |

> **原因**：business 主题 cardBg=#F5F7FA 浅色，深色模板用错主题会变白框（如 tech/1581）。此映射已统一到 qa-all.mjs / build-golden.mjs / qa-regress.mjs。

---

## 六、通用模板清单速查（类型根目录 18 个）

| 页面 | 模板文件 | 一句话说明 |
|---|---|---|
| 封面 | cover/hero-left.slide | 左大色块 + 右标题钩子（深底） |
| 封面 | cover/center-minimal.slide | 居中大字 + 一句话定位 |
| 封面 | cover/full-gradient.slide | 全屏渐变 + 居中标题 |
| 目录 | toc/numbered-list.slide | 左标题栏 + 右编号条目 |
| 目录 | toc/grid.slide | 网格卡片章节 |
| 转场 | transition/big-number.slide | 章节巨号 + 章节名 |
| 转场 | transition/banner.slide | 深色横幅 + 章节导语 |
| 结尾 | ending/summary-cta.slide | 结论回望 + 行动号召 |
| 结尾 | ending/thanks.slide | 金句 + 落款 |
| 内容 | content/argument.slide | 论点 + 论据 |
| 内容 | content/data.slide | 大数字数据 |
| 内容 | content/process.slide | 流程结构图 |
| 内容 | content/case.slide | 案例对比 |
| 内容 | content/comparison.slide | 对比矩阵 |
| 内容 | content/concept.slide | 概念拆解 |
| 内容 | content/problem.slide | 问题-方案 |
| 内容 | content/trend.slide | 趋势演进 |
| 内容 | content/summary.slide | 总结要点 |

---

## 七、黄金样本（回归 QA 基准）

`golden/manifest.json` 记录用户人工验证过的代表性模板，引擎改动后 `npm run qa:regress` 用它们做逐 shape 坐标回归对比。当前 11 个：

| golden | 源模板 | 主题 |
|---|---|---|
| 1521_四宫格 | content/cartoon/1521.slide | business |
| 1571_黑金右栏 | content/black-gold/1571.slide | redgold |
| 1051_结尾装饰 | ending/business/1051.slide | business |
| 016_手绘封面 | cover/hand-drawn/016.slide | business |
| 017_手绘多框 | cover/hand-drawn/017.slide | business |
| 020_手绘封面2 | cover/hand-drawn/020.slide | business |
| 1523_卡通对比 | content/cartoon/1523.slide | business |
| 1538_竞争对比 | content/business/1538.slide | business |
| 1551_文学双栏 | content/literary/1551.slide | culture |
| 1581_科技主题 | content/tech/1581.slide | tech |
| 1667_认识时钟 | content/educational/1667.slide | academic |

> 新增黄金样本：`node scripts/build-golden.mjs`（改 samples 数组）；用户手工验证 OK 的新模板 → 加进 golden（回归网越织越密）。

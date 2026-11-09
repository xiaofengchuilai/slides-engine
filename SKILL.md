---
name: slides-engine
display_name: 智能 PPT 引擎
display_name_en: PPT Studio Engine
description: 声明式幻灯片引擎：用 JSX 写 .slide，编译为专业 .pptx。内置自动折行、Flexbox 布局、溢出校验、语义色令牌与 678 个模板。触发词：做PPT、演示文稿、幻灯片、生成pptx、slides、slide deck。
description_zh: 用声明式语法写幻灯片并编译成可编辑的 .pptx，自带布局计算、自动折行、溢出校验与 678 个模板。
description_en: Write slides declaratively and compile to editable .pptx, with layout, wrapping, overflow checks and 678 templates built in.
examples_zh:
  - "帮我做一份 12 页的季度总结 PPT，商务蓝风格"
  - "把这份材料做成演示文稿，先给我大纲确认"
  - "这页内容溢出了，帮我调一下版式"
examples_en:
  - "Make a 12-slide quarterly review deck in business blue"
  - "Turn this material into a presentation, show me the outline first"
  - "This slide overflows, help me fix the layout"
version: 0.5.5
author: slides-engine contributors
license: MIT
---

# slides-engine 技能

用声明式幻灯片引擎（`slides-engine/`）把自然语言需求变成专业 .pptx。

**本技能 = 完整的方法论文档 + 自研渲染引擎。** `references/` 下的方法论文档（human-alignment / story-principle / design-principle / component-* 等）可直接复用。

本技能不绑定特定 Agent 平台。下面的能力对照表告诉你需要哪些能力、在你所在环境里分别对应什么工具；若某项能力缺失，按「降级策略」处理。

## 运行环境要求

### 必需能力（缺了无法完成）

| 能力 | Vanor | Claude Code | Cursor | Codex CLI | 通用做法 |
|---|---|---|---|---|---|
| 执行 shell 命令 | `exec` | `Bash` | 终端 | `shell` | 直接跑 `node src/cli.mjs` |
| 写文本文件 | `write_file` | `Write` | 内置编辑 | `apply_patch` | 任何写文件 API |
| 读文本文件 | `read_file` | `Read` | 内置 | `cat` / `Read` | 任何读文件 API |
| 列出目录 | `list_dir` | `LS` | 内置 | `ls` | 目录遍历 |
| **向用户提问并等回答** | `clarify` | 直接回复提问 | 直接回复提问 | 直接回复提问 | **纯文本提问，然后结束回合** |

> **提问能力是工作流的硬依赖**。本技能的「需求澄清 + 拷打式追问」全靠它。
> 没有结构化提问工具时，**直接在回复里列出编号问题并结束当前回合**——不要自问自答，也不要假定答案继续往下做。

### 可选能力（缺失有降级路径）

| 能力 | Vanor | Claude Code | Cursor | Codex CLI | **缺失时的降级** |
|---|---|---|---|---|---|
| 联网搜索 | `web_search` | `WebSearch` | `@Web` | 无内置 | 数据一律用 `[需要核实]` 占位，**禁止编造具体数字** |
| 读图审图 | `llm` + `attachments` | `Read`（图片） | 内置视觉 | 无 | 跳过视觉验收，改用 `render-png` + 人工查看 |
| 生成图片 | `llm action=image` | 无内置 | 无内置 | 无内置 | **全部改用 SVG / 图表 / 色块**（技能已内置此路径） |
| 交付文件给用户 | `send_file` | 直接给路径 | 内置 | 给路径 | 在回复里写出产物绝对路径 |
| 任务清单 | `plan` / `TaskCreate` | `TodoWrite` | 内置 todo | 无 | 不建任务清单，直接按 7 步流程走 |

### 降级策略详解

**① 没有生图能力（大多数环境）**

→ 跳过整个「图片流水线」阶段，所有需要视觉的页面用以下方式替代：
- `SVG` 组件画结构图 / 示意图 / 图标组合
- `Shape` + `Box` 做几何色块、渐变背景
- `Chart` 做数据可视化
- `FaIcon` 做图标

这一步不需要额外配置，`references/design-principle.md` 里的「SVG 兜底」章节就是为此准备的。

**② 没有联网能力**

→ 不得编造任何具体数字（营收、份额、增长率等）。所有数据写 `[需要核实]` 占位，并在交付时明确告知用户「这些数字需要你补充」。

**③ 没有视觉模型**

→ 跳过自动视觉验收环节。改用：
```bash
node src/cli.mjs render-png <页.slide> --out <页.png>   # 导出每页 PNG
node src/cli.mjs validate <项目>/slides                  # 机器校验（溢出/语法/资源）
```
然后把 PNG 给用户人工确认，或由你自己（若是多模态模型）直接查看。

**④ 编译失败（依赖未安装）**

→ 在引擎目录执行：
```bash
npm install
```
`canvas` 是原生模块，需要编译环境（见 README「安装」章节）。

## 快速导航

| 任务类型 | 执行路径 |
|---|---|
| 从零开始创建 PPT | 读 [create-from-scratch.md](references/create-from-scratch.md) |
| 基于上传材料创建 PPT | 读 [create-from-material.md](references/create-from-material.md) |
| 组件语法 | 读 references/component-*.md（Box/Text/Image/Table/Chart 等） |
| 引擎能力边界 | 读 [engine-capabilities.md](references/engine-capabilities.md)（哪些组件已实现/延后） |
| 内容范式（增量） | 读 [content-playbook.md](references/content-playbook.md)（按 PPT 类型给必讲骨架） |
| 信息组织范式（增量） | 读 [layout-playbook.md](references/layout-playbook.md)（左右不对称/大锚点/完整结论句/完整段落） |
| 选版式模板（增量） | 读 [template-library.md](references/templates/template-library.md)（18 个现成模板 + 匹配规则） |

## 引擎位置与命令

- 引擎目录：本 skill 根目录（即 `SKILL.md` 所在目录，含 `src/`、`references/`、`package.json`；**引擎源码 + 依赖均内置于此，不依赖外部路径**）
- 编译命令（在引擎目录下运行）：

```bash
# 目录模式（推荐）：slides/*.slide 按文件名排序成多页
node src/cli.mjs <项目目录>/slides --out <项目目录>/<名称>.pptx --theme <theme>

# 单文件模式：单页
node src/cli.mjs <文件>.slide --out <输出>.pptx --theme <theme>

# 机器校验：语法/资源/溢出
node src/cli.mjs validate <文件.slide|目录>
```

- `--theme` 可选：`business`（默认）/ `tech` / `culture` / `academic` / `consulting` / `redgold`
- 运行测试：`npm test`

## 命令对照

| 用途 | 命令 |
|---|---|
| 编译目录 | `node src/cli.mjs <dir>/slides --out <dir>/<名>.pptx` |
| 编译单页 | `node src/cli.mjs <file>.slide --out <名>.pptx` |
| 机器校验 | `node src/cli.mjs validate <dir>/slides`（语法+资源完整性校验，返回 success:true/false） |
| 单页导出 PNG | `node src/cli.mjs render-png <页.slide> --out <页.png>` |
| 生成图片 | 调用你环境的生图能力（先经用户授权）；**无此能力则跳过，改用 SVG/图表/色块** |
| 交付成品 | 把 `.pptx` 路径告诉用户（有发送文件能力就直接发送）；**逐页预览用 `render-png` 子命令**：`node src/cli.mjs render-png <页.slide> --out <页.png>` |
| 写页面源文件 | 用你环境的写文件工具把内容写入 `slides/{NN}.slide` |

## 需求澄清

1. **只问缺失的，文字提问 ≤3 个**，一轮问完。
2. **风格预览卡按需触发**（见 human-alignment.md §2.3）。

完整对齐逻辑见 [human-alignment.md](references/human-alignment.md)。

## 目录结构规范

```
<workspace_dir>/
├── <project_dir>/
│   ├── STORY.md
│   ├── DESIGN.md
│   ├── assets/
│   ├── slides/
│   │   ├── 01.slide
│   │   └── 02.slide
│   └── <名称>.pptx
```

## 工作流硬约束（钉死不可跳）

### 约束 A0：信息收集硬门槛（数据/时效类主题，动笔前必过）

主题涉及 `数字 / 市场 / 行业 / 新闻 / 竞品 / 分析 / 战略` 时，**必须先完成 create-from-scratch.md Step1 的硬流程**：

- 5 层查询（定义/背景/证据/案例/趋势）+ 竞品/战略类加「财务/营收」层，**禁止只搜一个口径**；
- 6 维度强制归类；
- 质量验收：**≥3 高权威源 + ≥5 域名**；竞品必须附真实财务数据（营收/增速/份额），不能只有百分比排名。

> 数据深度不靠模型临场发挥，靠硬性数量指标兑底。不达标禁止进入 STORY 阶段。

### 约束 A：DESIGN.md 必须含「页面映射表」（逐页契约）

走通用路线生成 DESIGN.md 时，**必须包含 design-principle.md §6 的「页面映射表」**——为每一页预先定死这 9 个字段：

| 字段 | 示例 |
|---|---|
| 文件 | 01_cover.slide |
| 类型 | cover / catalog / content |
| 角色 | hero / supporting / transition |
| 版式 | 全屏视觉+骑线文字 / 左大图+右叠层文字 / 巨型数字+洞察 |
| L1文件 | hero_landscape.png（或 —） |
| 字数估算 | 30 / 120 / 180 / 220 |
| 留白% | 35% / 25% / 28% |
| 色彩分配 | 主色60%+辅色30% / 强调色20%爆发 |
| 关键约束 | 全幅底图+左侧大标题 / ≥48px锚点数字 / 每项≥30字 |
| 图片需求 | 无 / 数据图：市场规模增长曲线，蓝紫渐变商务风（对齐 STORY 的 image_requirements） |

**这张表是 STORY.md 与 slides/*.slide 之间的「契约」，逐页生成时严格对照。没有这张表 = DESIGN.md 不完整，禁止进入逐页生成。**

**图片列（图片需求）是图片流水线的输入**：有需求的页 → 图片阶段生图（用你环境的生图能力）→ 生成后填真实 src；无 → 删掉 Image。详见 §图片流水线。

### 约束 A2：流程/架构类页的 visual 必须定为结构图（防「卡片化」降级）

写 STORY.md 的 `visual` / `visual_role` 字段时，凡一页核心信息是「流程推进 / 阶段任务分解 / 并行任务关系 / 层级架构」，必须：
- `visual` 写具体结构图类型（流程图/时间轴/问题树/树状图/组织图/价值链/矩阵），层级 **L1**
- `visual_role` = **anchor**（图是主角）
- **禁止**降级成 `L2 阶段分区卡+编号块+清单`、**禁止** `visual_role` 写成 `evidence`/`atmosphere`

反例：EVT 页把 `visual` 写成「阶段分区卡+清单」+ `role=evidence`，结果做成了并列列表；正确写法是「L1 EVT流程图SVG」+ `role=anchor`。详见 story-principle.md §visual 字段标注规则。

### 图片流水线（独立阶段）

STORY/DESIGN 完成后、逐页生成前，先跑图片流水线。**图片是独立的、前置的流程**，不是逐页生成时临时判断。

**① 提取图片需求**：扫描 STORY.md / DESIGN.md 页面映射表，收集所有写了 `image_requirements` 的页 → 得到图片任务清单。

**② 40% 纪律检查**：有图页数 ≤ 总页数 40%（10 页最多 4 页有图）。超了就砍掉次要页的 image_requirements（保留 anchor 主视觉页）。

**③ 逐张生图**（每张都要用户授权，禁止未经确认生图）：
- 调用你环境的生图能力，prompt 用 image_requirements 的 `描述 + 风格`，尺寸按图片位宽高比（如 1024x1024 / 1024x1536）
- 生完**立即校验文件存在**（不存在 → 报错重试，不继续）
- 输出到项目 `assets/images/`，命名 `<页码>-<序号>.png`

**④ 逐页生成 .slide 时**（Phase 7 渲染）：
- 该页有图 → `<Image src="../assets/images/<页码>-<序号>.png" style={{...}} />` 直接写真路径（**注意：Image src 相对 slides/ 目录，用 `../assets/images/` 指回项目根**）
- 该页无图 → **删除整个 `<Image>` 元素**（NEVER leave placeholder images）
- 校验：编译后该页应有图（python-pptx 或 render-png 检查）

**⑤ 换图**（用户要求改图时）：**直接改 .slide 的 Image src + 重编译**——生成新图覆盖 `assets/images/<页码>-<序号>.png` 同名文件（或改 src 指向新文件），再编译。**不设 mapping.json 映射层**（曾设计 images-mapping.json「换图只改 mapping」，因引擎不读 mapping、且 .slide 已写真路径而废弃——改 src + 重编译是唯一可靠路径）。

### 约束 B：逐页即时自检（每页写完立即验，通过才写下一页）

**这是执行质量的核心，也是最容易偷懒跳过的一步。**

写每一页 .slide 的完整动作：

1. **写前**：回读 DESIGN.md 页面映射表里**这一页**的 9 个字段，作为本页唯一依据。
2. **写后（立即）**：逐条对照契约值核对产物——字数够不够、留白超没超、用了几个颜色（≤4 彩色）、锚点有没有、标题是不是完整结论句、版式对不对、role 对不对。
3. **机器校验（立即）**：`node src/cli.mjs validate <该页.slide>`，语法/资源/溢出不通过 → 当场修。
4. **视觉验收（立即）**：编译导出该页 PNG，用视觉模型对照 DESIGN.md 契约 + 约束来源清单检查，发现"空/少/薄/溢出/单调" → 当场返工。

**任意一步不达标 → 当页返工，直到通过才写下一页。禁止"先写完所有页，最后一起自检"。**

这是 create-from-scratch.md Step6「动笔自检 10 条，每页提交前逐项确认，任意不通过 → 当页返工」的完整落地——**自检是逐页即时的，不是最后一次性。**

### 约束 C：并列/多列内容禁止绝对定位手工排 x（2026-09-02 教训）

**并列内容（多卡/多列/多项行动/时间轴节点/对比项）一律用 flex 布局**（`flexDirection:'row'` + 每项 `flex:1` + 列内 Text 自动折行），**禁止**用 `position:absolute` + 手工 `left` 排布：

- ❌ 反例（真实翻车）：生成「平凡的世界」页10 三行动项时，Agent 用 `position:absolute, top:332, left:554/618/682` 排三项 → 每项说明 Text 无宽度约束自由延伸（375px+），远超 64px 列距 → **三列文字互相重叠、编号偏位**
- ✅ 正确：`<Box flexDirection:'row' gap:'xl'>` + 每项 `<Box flex:1>`，Text 放列内自动被列宽约束折行（引擎已保证 flex:1 长文本折行，见 postFixTextWrap）
- `position:absolute` 只用于**单个装饰元素**（光晕/角标/水印）相对容器定位，**绝不用于排多个并列内容单元**

判断：写完 .slide 后渲染 PNG，若并列项文字重叠/编号错位 → 检查是否用了绝对定位排多项，改成 flex。

### 约束 D：模板优先复用（每页先选模板再填空，2026-09-03 新增）

**生成每页不存在「从空白画布发明版式」的路径**：按 `页面类型 → 内容结构 9 类型 → 3 优先级匹配` 从模板库选页面级成品（布局/装饰/页脚内联固化），Agent 只替换占位文字——从而天然全篇一致、无页脚漂移/无版式类返工。**本约束把该机制固化进工作流：写任何一页 .slide 前，必须先完成模板选型；命中模板就用模板填空，禁止直接手写；仅模板库无匹配时才允许手写（需过全部纪律）。**

强制步骤（每页，写前执行）：
1. 读 `references/templates/template-library.md`（索引 + 匹配规则）。
2. 判本页类型（cover/toc/transition/ending/content；content 判内容结构 9 类型）。
3. 3 优先级匹配：布局结构 → 内容密度 → 视觉多样性（同一模板全篇 ≤2 次、相邻页不同模板）。
4. 风格定位：按整篇基调选风格子目录（business/tech/black-gold/…）；命中预设分支（academic/consulting/redgold）选对应主题模板并叠加分支色板。
5. 读模板 .slide → 替换 `{{替换：xxx}}` 占位 → 写为 slides/{NN}.slide → validate → 逐页视觉验收（约束 B）。

**最小变通（模板库无匹配时）**：选结构最接近的模板改色板，或手写——手写页必须满足 Step6 动笔自检 10 条 + 约束 B/C，且页脚/底条用已验写法（满高根容器内 absolute bottom:20 锚画布底，见 design-principle 页脚细则），禁止从零发明版式。

> 违反表现（返工信号）：未读 template-library 就写页、同版式连续多页、页脚位置漂移、等宽卡堆叠、无锚点——任一出现即回退到模板选型重做。

## 页面校验（validate，两层时机）

**第一层（逐页即时，每页写完就跑）**：`node src/cli.mjs validate <该页.slide>`——机器校验语法/资源/溢出，不通过当场修（见约束 B）。

**第二层（全部写完，最后跑全量兜底）**：

```bash
node src/cli.mjs validate <项目目录>/slides
```

- 校验**机器能判定的违规**：语法错误 / import·export·module 模块语句 / 编造图标名 / image:// 或在线地址占位符 / 内容溢出画布 / 组件参数缺失
- 返回 `success: true/false` + 逐页错误清单；`success: false` 时根据错误清单修复，直到 `success: true`
- **不查设计审美**（密度/锚点/Action Title 靠约束 B 的逐页视觉验收 + 下面的 PowerPoint 自测）

## PowerPoint 自测（铁律，不可跳过）

生成 pptx 后，用 win32com 导出每页 PNG，**逐页**用视觉模型检查。检查时**必须逐条对照以下全部约束来源**，不能只凭感觉：

### 自检的完整约束来源（逐条对照，缺一不可）

1. **动笔自检 10 条**（见 create-from-scratch.md Step6）：母版三区齐全 / 标题块不塞小图 / L1主视觉≥30% / ≤4hex+≤2字体 / 版式不重复+留白≤35% / ≥1视觉锚点 / 视觉重量差异 / 色彩面积合规 / role一致。

2. **通用设计硬门禁**（见 design-principle.md §设计总则 + §4 信息密度门禁 + §5 配图系统）：**内容优先于节奏**（流程/架构/阶段/拆解类内容优先用结构图，禁止用巨型数字或列表替代）+ §4 密度门禁表（各页型字数下限/元素数下限/主视觉占比）+ §4.1 容器填充率≥85% + §4.2 留白策略 + §5 配图分级（L1/L2/L3）。**注意：通用 design-principle 没有独立的"硬闸门 15 条"章节；只有当命中学术/咨询/红金分支时，才额外读对应分支文件的"最终硬闸门"（consulting §7 有 17 条，逐条过，违反即返工）。**

3. **内容饱满度 + 元素丰富度**（见 content-playbook.md）：空话黑名单 / 结论+支撑 / 每页≥1符号化元素 / 元素丰富度6条≥4条（圆角卡片/编号块/装饰线/颜色≥3层/结构化引导/主题标注）。

4. **信息组织范式**（见 layout-playbook.md）：左右不对称 / 大视觉锚点占一侧 / 标题完整结论句 / 正文完整段落≥2行 / 小编号块+完整标题+两行正文 / 色彩语义分层。

5. **组件语法约束**（见对应 component-*.md）：数值必须 number / 行列数一致 / 图标名存在 / src 本地路径 / 禁 emoji / 高度≤720 / 换行用 br 等。

### 执行要求

**逐页对照以上 5 类约束，任意一条不达标 → 先扩内容/补装饰/重排版/修语法，再重新生成，直到全过。严禁把"只有上半部分""内容空""元素单调""文字溢出"的页面直接交付。**

**视觉模型检查范围限定（防误判）**：视觉模型只负责查「看得清、能确定」的**宏观版式问题**（溢出/大块空白/元素重叠/版式单调/无锚点）。**不要**让视觉模型判断「图表标签是否有字、具体数字对错、小字内容对错」这类需精确识别的细节——它判不准，会误伤；这些靠机器校验（validate）+ 数据真实性门禁保障。拿不准、看不清的项按通过处理，不要凭猜判错。

```python
import win32com.client
ppt = win32com.client.Dispatch("PowerPoint.Application")
pres = ppt.Presentations.Open(r'<绝对路径>.pptx', WithWindow=False)
for i in range(1, pres.Slides.Count + 1):
    pres.Slides.Item(i).Export(rf'<目录>\_p{i}.png', 'PNG', 1280, 720)
pres.Close(); ppt.Quit()
```

> **关键**：自测不是"看一遍就过"。必须逐条对照上面 5 类约束清单，发现不达标就返工（扩充/补齐/重排），而不是把问题页交付给用户。

## 已知边界

1. **PowerPoint 是最终正确性标准**，第三方预览器对 OOXML 复杂对象（图表数据标签/横轴/图例位置）有支持局限，不追。
2. **Animation（动画）明确不支持**：遇用户要求动画时，如实告知"当前引擎不支持动画"，不要尝试生成假 timing XML（会导致 PowerPoint 无法打开）。原因详见 engine-capabilities.md §Animation 专项说明。
3. 其余组件能力（渐变/Math/CodeBlock/clipPath 等）以 engine-capabilities.md 的"已实现"清单为准，生成前必读。

## 参考文件

- `references/human-alignment.md`：需求对齐
- `references/story-principle.md`：STORY 骨架契约
- `references/design-principle.md`：DESIGN 硬门禁
- `references/designs/design-principle.{academic,consulting,redgold}.md`：三套预设风格
- `references/create-from-scratch.md` / `create-from-material.md`：工作流
- `references/component-*.md`：组件规范
- `references/engine-capabilities.md`：**引擎能力边界**（已实现/未支持清单，生成前必读）
- `references/content-playbook.md`：**内容范式**（我们的增量，按 PPT 类型给必讲骨架）
- `references/templates/template-library.md`：**模板库索引 + 匹配规则**（选模板时先读）
- `references/templates/README.md`：模板库规范（语义色/占位符约定）
- `references/templates/{cover,toc,transition,ending,content}/`：18 个现成 .slide 模板（Agent 选模板后填内容）

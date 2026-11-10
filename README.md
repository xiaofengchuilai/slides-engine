# slides-engine

> 声明式幻灯片引擎：用 JSX 写 `.slide`，编译成真正的 `.pptx`。
> 不调用 PowerPoint / LibreOffice，纯 Node.js 生成，版式稳定可复现。

![slides-engine 效果预览](docs/images/preview.png)

左：封面 · 中：商务内容页 · 右：科技风内容页（共 6 套主题可选）

```jsx
// cover.slide
<Slide style={{ background: 'bg' }}>
  <Box style={{ padding: 72, height: '100%', justifyContent: 'center' }}>
    <Text style={{ fontSize: 56, bold: true, color: 'text' }}>2026 年第三季度复盘</Text>
    <Text style={{ fontSize: 22, color: 'muted', marginTop: 16 }}>华东大区 · 2026-10</Text>
  </Box>
</Slide>
```

```bash
node src/cli.mjs ./slides --out 复盘.pptx --theme business
```

---

## 它解决什么问题

用模板做 PPT 的人会撞上两类墙：

- **纯代码生成库**（pptxgenjs 等）：能生成，但每个元素都要手算 `x/y/w/h`，排版全靠猜。
- **模板填充**：版式保住了，但内容一长就溢出，改起来比重新做还慢。

slides-engine 取中间路线：**写了 `.slide` 就自动折行、自动布局、自动校验溢出**，产物是标准 OOXML，能在 PowerPoint / WPS / Keynote 里正常打开和编辑（不是转成图片贴进去）。

## 特性

| | |
|---|---|
| **声明式** | JSX 语法，`Box` / `Text` / `Image` / `Chart` / `Table` / `SVG` / `Shape` 等 14 类组件 |
| **自动布局** | 基于 Yoga（Flexbox）计算，`flex` / `gap` / `padding` / `justifyContent` 全部支持 |
| **自动折行** | 内置 CJK 全角字符宽度测量，中文断行、行高、字距都按真实字体度量 |
| **溢出校验** | `validate` 逐页检查，文字超出容器会直接报错，不会生成"看起来对但打开就错位"的文件 |
| **语义色令牌** | 6 套主题，颜色只用 `primary` / `text` / `muted` 等语义名，一键换主题不破坏版式 |
| **678 个模板** | `references/templates/` 内置封面/目录/内容/结尾等现成版式 |
| **零 Office 依赖** | 不需要装 PowerPoint、不需要 LibreOffice、不调外部服务 |

## 安装

```bash
git clone https://github.com/<your-org>/slides-engine.git
cd slides-engine
npm install
```

> `canvas` 是原生模块，需要系统具备编译环境：
> - **Windows**：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（勾选「使用 C++ 的桌面开发」）
> - **macOS**：`xcode-select --install`
> - **Linux**：`sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

## 快速上手

```bash
# 1. 校验（不生成文件，只查语法与溢出）
node src/cli.mjs validate ./slides --theme business

# 2. 编译
node src/cli.mjs ./slides --out output.pptx --theme business

# 3. 单页导出 PNG（自查版式用）
node src/cli.mjs render-png ./slides/01.slide --out p1.png --theme business
```

目录模式下，`slides/*.slide` 按文件名排序 → 逐页成稿。

### 可用主题

`business` · `tech` · `culture` · `academic` · `consulting` · `redgold`

## 组件

| 组件 | 用途 |
|---|---|
| `Slide` | 页面根，只负责尺寸与背景 |
| `Box` | 布局容器（flex） |
| `Text` | 文本，支持自动折行、行高、字距 |
| `Image` | 图片（本地路径 / URL / base64） |
| `Shape` | 基础图形（矩形、圆形、箭头等） |
| `Table` | 表格 |
| `Chart` | 图表（柱状/折线/饼图等） |
| `SVG` | 内联矢量图 |
| `FaIcon` | FontAwesome 图标 |
| `QRCode` | 二维码 |
| `CodeBlock` | 代码块（语法高亮） |
| `Math` | LaTeX 公式 |
| `Diagram` | 结构图 / 流程图封装 |
| `Hyperlink` | 超链接 |

每个组件的完整属性见 `references/component-*.md`。

## 设计要求

引擎只解决"能不能正确渲染"，"好不好看"要靠设计原则：

- `references/design-principle.md` — 通用设计法则（密度、留白、视觉锚点、色彩面积）
- `references/designs/` — 领域特化分支（商务/科技/国风等）
- `references/content-playbook.md` — 内容组织范式
- `references/story-principle.md` — 叙事结构
- `references/engine-capabilities.md` — **引擎能力边界与布局硬规则（写页前必读）**

## 实现说明

引擎在行高系数、文本框内边距、图表默认值等细节上采用固定渲染约定，以保证产物在不同预览器里表现一致。所有实现均为本项目自行编写，不依赖任何外部闭源组件。

## 作为 AI Agent 技能使用

本目录同时是一个 **通用 Agent Skill**，不绑定特定平台。

### 安装到不同的 Agent

| 环境 | 怎么做 |
|---|---|
| **Vanor** | 把目录放到 `~/.vanor/skills/slides-engine/`，重启后自动识别 |
| **Claude Code** | 放到 `.claude/skills/slides-engine/`（项目级）或 `~/.claude/skills/`（全局）；没有 skills 机制时，直接让 Agent「读 SKILL.md」 |
| **Cursor** | 放在项目里，靠 `AGENTS.md`（已内置）自动加载；或手动 `@SKILL.md` |
| **Codex CLI** | 靠 `AGENTS.md`（已内置）自动加载 |
| **其他 Agent** | 把 `AGENTS.md` 或 `SKILL.md` 作为系统提示的一部分送入 |

### 需要什么能力

**必需**：执行 shell、读写文件。
**可选**：联网搜索、读图、生图（缺失有降级路径）。

详细的「能力 → 各平台工具」对照表在 [`SKILL.md` § 运行环境要求](SKILL.md)。

关键降级行为：
- **无生图能力**（大多数环境）→ 跳过图片流水线，全用 `SVG` / `Shape` / `Chart` / `FaIcon`
- **无联网能力** → 数据写 `[需要核实]` 占位，禁止编造
- **无视觉模型** → 用 `render-png` 导出 PNG 交人工确认

### 入口文件优先级

1. `AGENTS.md` —— 给 Cursor / Codex / Copilot 等自动读取，最小可用路径
2. `SKILL.md` —— 完整工作流（给支持 skills 的 Agent）
3. `references/` —— 按需读的细节文档

## 开发

```bash
npm test              # 单元测试
npm run qa            # 全量质量检查
npm run qa:quick      # 只查封面类
npm run qa:regress    # 回归（需先生成 golden）
npm run qa:golden     # 重建 golden 基准
```

> `golden/` 是回归基准（渲染好的 pptx），不入仓库，用 `npm run qa:golden` 本地生成。

## 目录结构

```
src/            引擎核心（布局/测量/渲染/校验/OOXML 输出）
  ├─ layout.mjs      Yoga 布局计算
  ├─ measure.mjs     文本测量与折行（含 CJK 全角处理）
  ├─ validate.mjs    溢出与对比度校验
  ├─ output.mjs      OOXML 生成
  └─ theme.mjs       6 套主题令牌
references/     文档与 678 个 .slide 模板
scripts/        质量检查脚本
tools/          辅助工具
```

## 已知限制

- `Chart` 的精细样式（渐变填充、复杂坐标轴格式）覆盖有限
- 动画/切换效果仅生成占位，不生成实际动画
- 复杂 SmartArt 不支持（用 `Shape` + `Box` 手工搭）
- 字体需在生成端与查看端都存在，否则会 fallback

## 第三方资源

见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## License

[MIT](LICENSE)

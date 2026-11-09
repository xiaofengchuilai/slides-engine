# AGENTS.md — slides-engine

本仓库是一个**声明式幻灯片引擎** + **AI Agent 技能**。用 JSX 写 `.slide`，编译成真正的 `.pptx`。

## 你要做什么

接到「做 PPT / 演示文稿 / 幻灯片 / 生成 pptx」类需求时：

1. **先读 [`SKILL.md`](SKILL.md)** —— 这是入口文档，包含完整工作流、能力对照表、降级策略。
2. 需要细节时再按需读 `references/` 里的对应文档（组件规范、设计原则、内容范式等）。
3. 不要凭印象直接写 `.slide`；先确认引擎在你环境里能跑起来（见下）。

## 最小可用路径

```bash
# 1. 安装依赖（首次）
npm install

# 2. 建项目结构
mkdir -p <项目>/slides

# 3. 写页（JSX）
#    <项目>/slides/01.slide

# 4. 校验
node src/cli.mjs validate <项目>/slides --theme business

# 5. 编译
node src/cli.mjs <项目>/slides --out <项目>/<名称>.pptx --theme business

# 6. 单页导出 PNG（自查版式）
node src/cli.mjs render-png <项目>/slides/01.slide --out <页.png>
```

## 硬规则（违反会导致产物错误）

- **开工前必须先做需求澄清**（读 `references/human-alignment.md`，它是唯一权威）——命中拷打触发条件时必须追问；提问后**结束回合等用户回答**，不得自问自答或假定答案继续
- **写页前必须读** `references/engine-capabilities.md`（引擎能力边界与布局硬规则）
- **颜色只用语义 token**（`primary` / `text` / `muted` 等），禁止写死 hex
- **内容总高度 ≤ 720px**（Slide 固定高），否则 `validate` 报溢出
- **`Slide` 根组件不响应 flex 布局属性**，布局要套内层 `<Box>`
- **`validate` 必须 0 错误 0 警告**才能交付

## 能力缺失时的降级

| 缺什么 | 怎么办 |
|---|---|
| **结构化提问工具** | **直接用文字列编号问题，然后结束回合**——这是默认做法，不影响拷打效果 |
| 生图能力 | 跳过图片流水线，全部用 `SVG` / `Shape` / `Chart` / `FaIcon` |
| 联网搜索 | 数据写 `[需要核实]` 占位，**禁止编造具体数字** |
| 视觉模型 | 用 `render-png` 导出 PNG 交用户人工确认 |

完整对照表见 `SKILL.md` § 运行环境要求。

## 不要做的事

- 不要修改 `src/` 下的引擎代码来「绕过」校验错误——先修 `.slide`
- 不要把 `node_modules/` 或 `golden/` 提交进仓库
- 不要在 `.slide` 里引入外部依赖或执行副作用代码（沙箱会拦截）

## 项目结构

```
src/            引擎核心（布局 / 测量 / 渲染 / 校验 / OOXML 输出）
references/     文档与 678 个 .slide 模板
  ├─ component-*.md    组件规范
  ├─ design-principle.md  设计法则
  ├─ content-playbook.md  内容范式
  └─ templates/        模板库
scripts/        质量检查脚本
SKILL.md        技能入口（完整工作流）
README.md       项目说明
```

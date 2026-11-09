# 第三方资源声明

本项目包含或依赖以下第三方资源。各资源的版权归其原作者所有，使用时请遵守对应许可证。

---

## 运行时依赖（`package.json`）

| 依赖 | 许可证 | 用途 |
|---|---|---|
| [pptxgenjs](https://github.com/gitbrent/PptxGenJS) | MIT | 生成 OOXML（.pptx）文件 |
| [@swc/core](https://swc.rs/) | Apache-2.0 | 编译 `.slide` 中的 JSX |
| [yoga-wasm-web](https://github.com/vislyhq/yoga-wasm-web) | MIT | Flexbox 布局计算（Yoga 的 WASM 封装） |
| [canvas](https://github.com/Automattic/node-canvas) | MIT | 文本测量与位图渲染（含 Cairo/Pango 等 LGPL 组件） |
| [shiki](https://shiki.style/) | MIT | 代码块语法高亮 |
| [mathjax](https://www.mathjax.org/) / [mathjax-full](https://github.com/mathjax/MathJax) | Apache-2.0 | LaTeX 公式渲染 |
| [qrcode](https://github.com/soldair/node-qrcode) | MIT | 二维码生成 |
| [@fortawesome/fontawesome-free](https://fontawesome.com/) | **混合许可**（见下） | 图标字体 |

---

## 内嵌资源（`src/vendor/`、`src/assets/`）

### rough.js — `src/vendor/rough/rough.cjs`

- **许可证**：MIT
- **版权**：Copyright (c) 2019 Preet Shihn
- **来源**：https://github.com/rough-stuff/rough
- **用途**：手绘风格图形的路径生成

### Twemoji 表情图 — `src/assets/emoji/*.png`（189 个 PNG）

- **许可证**：**CC-BY 4.0**（图形）／ **MIT**（代码）
- **版权**：Copyright 2020 Twitter, Inc and other contributors
- **来源**：https://github.com/twitter/twemoji（`twemoji@14.0.2`）
- **用途**：离线渲染彩色 emoji（转为 data URI 嵌入 pptx）
- ⚠️ **商用需署名**：CC-BY 4.0 要求保留署名。本项目已在 `README.md` 与本文件中署名。

### FontAwesome 图标字体

- **图标**：CC BY 4.0
- **字体**：SIL OFL 1.1
- **代码**：MIT
- **来源**：https://fontawesome.com/
- ⚠️ 免费版图标商用需遵守 CC BY 4.0 署名要求

---

## 内置模板（`references/templates/`，678 个 `.slide`）

这些模板为本项目自行编写，遵循本项目 [LICENSE](LICENSE)（MIT）。

若你在二次分发时替换或新增模板，请自行确认其来源与许可。

---

## 字体

本引擎**不内嵌字体文件**。生成的 `.pptx` 会引用系统字体名（如 `Microsoft YaHei`、`思源黑体` 等）。

- 生成端需要有对应字体才能正确测量排版
- 查看端若缺少同名字体，PowerPoint/WPS 会自动 fallback，可能导致版式偏移
- 请确保你使用的字体具备相应的商用授权

---

## 关于 `node_modules`

`node_modules/` 已通过 `.gitignore` 排除，不随本仓库分发。使用 `npm install` 安装时会按各包自身的许可证获取。

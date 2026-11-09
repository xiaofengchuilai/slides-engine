// P1 布局：组件树 → Yoga 节点 → 布局 → 像素坐标
// 关键设计（修复版）：
//   - Text 用 setMeasureFunc 返回「固有尺寸」（文本实际宽 + 真实行高）
//   - column 布局里 Text 会被 stretch 到容器宽度
//   - row 布局里 Text 用固有宽度
//   - 行高用 canvas 真实 ascent+descent，非 fontSize×系数

import Yoga from 'yoga-wasm-web/auto';
import { measureWidth, measureLineHeight, wrapText } from './measure.mjs';
import { getTheme, resolveFontSize, resolveSpacing, resolveRadius } from './theme.mjs';
import { handFont } from './fonts.mjs';

export const CANVAS = { width: 1280, height: 720 };

// 解析字体语义：'hand' → 手绘字体（Comic Sans MS，跨平台探测）；其他 → 原样
function resolveFontFamily(family, theme) {
  if (family === 'hand') return handFont() || theme.typography.body;
  return family || theme.typography.body;
}

export function layout(tree, { theme = 'business' } = {}) {
  const yoga = Yoga;
  const t = getTheme(theme);
  const root = buildYoga(tree, yoga, t);
  root.calculateLayout(CANVAS.width, CANVAS.height, yoga.DIRECTION_LTR);
  collectLayout(tree, 0, 0); // 传入根偏移 (0,0)，累加成绝对坐标
  postFixTextWrap(tree, t); // 修复 flex:1 Text 未折行（Yoga measure 时序导致）
  freeYogaNodes(tree);
  return tree;
}

// flex:1/flexGrow 的 Text 在 Yoga 里 measure 时序异常（首次 measure 无可用宽 → 不折行，
// 之后 stretch/分配宽但不再重测）→ 折行缺失、单行溢出容器（实例：content/tech/1687 描述文字）。
// 布局后补一次折行：若 Text 最终布局宽 < 单行 intrinsic 宽，用最终宽重折，写回 _wrappedLines/_wrappedRuns。
function postFixTextWrap(node, theme) {
  if (!node || typeof node !== 'object') return;
  const L = node._layout;
  if (node.type === 'Text' && L && node._text) {
    const style = (node.props && node.props.style) || {};
    const isFlex = style.flex === 1 || style.flexGrow === 1;
    // 只处理 flex 拉伸且 measure 阶段未折行的 Text（无 flex 的 Text 已正常折行）
    if (isFlex) {
      const fontSize = node._fontSize || resolveFontSize(style.fontSize) || 18;
      const fontFamily = node._fontFamily;
      const fontWeight = node._fontWeight || (style.bold ? 'bold' : '');
      const lineH = measureLineHeight(fontSize, { lineHeight: node._lineHeight || style.lineHeight || 1.0 });
      const letterSpacing = node._letterSpacing ?? (style.letterSpacing || 0);
      const intrinsicW = measureWidth(node._text, { fontSize, fontFamily, fontWeight, letterSpacing });
      // 容器比单行窄 → 应折行。用最终宽（≤ 容器）重折
      if (L.width < intrinsicW && L.width > 0) {
        const availW = Math.max(1, L.width);
        const lines = wrapText(node._text, availW, { fontSize, fontFamily, fontWeight, letterSpacing });
        node._wrappedLines = lines;
        if (node._runs) node._wrappedRuns = runsByLines(node._text, lines, node._runs);
        // 注意：不改 _layout.height——flex:1 的意图是撑满剩余空间（把底部内容推到底），
        // 只补折行（文字顶部对齐在撑满的框内显示），高度保持 Yoga 分配的拉伸值。
      }
    }
  }
  for (const c of node.children || []) {
    if (!isLayoutNode(c)) continue;
    postFixTextWrap(c, theme);
  }
}

function buildYoga(node, yoga, theme) {
  if (!node || typeof node === 'string') return null;

  const yNode = yoga.Node.create();
  node.__yogaNode = yNode;

  const style = (node.props && node.props.style) || {};
  applyStyle(yNode, style, yoga);

  if (node.type === 'Slide') {
    yNode.setWidth(CANVAS.width);
    yNode.setHeight(CANVAS.height);
  } else if (node.type === 'Box') {
    if (style.flexDirection) {
      yNode.setFlexDirection(mapFlexDirection(style.flexDirection, yoga));
    } else {
      yNode.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN);
    }
    if (style.justifyContent) yNode.setJustifyContent(mapJustify(style.justifyContent, yoga));
    if (style.alignItems) {
      yNode.setAlignItems(mapAlign(style.alignItems, yoga));
    } else if (style.flexDirection === 'row' || style.flexDirection === 'row-reverse') {
      // row 默认对齐策略（修复嵌套 flex 塌陷 + 同行混排错位 的平衡）：
      //   - 子项含 flex:1/grow（期望撑满父高，如列容器/卡片）→ stretch（否则内部再 flex:1 全塌 h=0）；
      //   - 子项全是 Box 容器（哪怕无 flex:1，如「左列+右列」分栏）→ stretch（CSS flexbox 默认，列容器应撑满
      //     父高，否则列内 flex:1 卡无剩余空间可分 → 塌缩成 0/极小、space-between 失效 → 文字堆叠重叠+底部空白，
      //     实例：党建 PPT 04/05 页 2×2 卡布局）；
      //   - 存在非 Box 子项（Text/FAIcon/Emoji/Shape 等直接混排在 row 里的"同行元素"，如「标签+数字+图标」）
      //     → center（顶部对齐会让大小字/图标视觉错位）。
      // 注意：position:absolute 子项不参与流式布局，绝不能计入判定（否则 absolute 装饰线/图会覆盖模板
      // 显式 alignItems:flex-end/baseline 等底对齐语义）。
      const flowKids = (node.children || []).filter((c) => {
        if (typeof c !== 'object' || !c) return false;
        const cs = (c.props && c.props.style) || {};
        return cs.position !== 'absolute';
      });
      // 有 grow 子项 → stretch（列容器/卡片期望撑满父高）；
      // 否则若子项全是「无显式 height 的纯容器 Box」（分栏列，依赖 stretch 撑满高）→ stretch；
      // 子项含固定 height 的块（大小字卡片/标签块）或非 Box 混排 → center（顶部对齐/拉伸会让同行视觉错位）。
      const hasGrow = flowKids.some((c) => {
        const cs = (c.props && c.props.style) || {};
        return cs.flex === 1 || cs.flexGrow === 1;
      });
      const noHBoxes = flowKids.some((c) => {
        if (c.type !== 'Box') return false;
        const cs = (c.props && c.props.style) || {};
        return cs.height === undefined && cs.flex !== 1 && cs.flexGrow !== 1;
      });
      const hasFixed = flowKids.some((c) => {
        if (typeof c !== 'object' || !c) return false;
        const cs = (c.props && c.props.style) || {};
        return cs.height !== undefined || c.type !== 'Box';
      });
      // 规则：有 grow → stretch；无 height 的纯 Box 容器存在且无固定高混排 → stretch；其余 center。
      yNode.setAlignItems(hasGrow || (noHBoxes && !hasFixed) ? yoga.ALIGN_STRETCH : yoga.ALIGN_CENTER);
    }
    if (style.flexWrap) yNode.setFlexWrap(mapFlexWrap(style.flexWrap, yoga));
    if (style.gap) yNode.setGap(yoga.GUTTER_ALL, resolveSpacing(style.gap));
    if (style.width) yNode.setWidth(style.width);
    if (style.height) yNode.setHeight(style.height);
  } else if (node.type === 'Text') {
    const text = extractText(node); // 提取完整文本（含 span 内的文字）
    const fontSize = resolveFontSize(style.fontSize) || 18;
    const fontFamily = resolveFontFamily(style.fontFamily, theme); // 默认主题字体
    const fontWeight = style.bold ? 'bold' : (style.fontWeight || '');
    const lineHeight = style.lineHeight || 1.0; // 默认行高倍数 1.0
    const letterSpacing = style.letterSpacing || 0; // 字距参与测量/折行（渲染 charSpacing 会加宽，测量必须同步）

    // 记录文本信息供输出层使用（富文本用 _runs 承载多段样式）
    node._text = text;
    node._fontSize = fontSize;
    node._fontFamily = fontFamily;
    node._fontWeight = fontWeight;
    node._lineHeight = lineHeight;
    node._letterSpacing = letterSpacing;
    node._runs = extractRuns(node); // 富文本 runs（无 span 时为 null）

    // 固有尺寸：单行宽度按完整文本测量（含字距），单行高度 = 行高
    const intrinsicW = measureWidth(text, { fontSize, fontFamily, fontWeight, letterSpacing });
    const lineH = measureLineHeight(fontSize, { lineHeight });

    // measure func：根据 Yoga 传入的可用宽度折行，返回折行后的尺寸
    yNode.setMeasureFunc((_w, _wm, _h, _hm) => {
      // 可用宽度（Yoga 传入，可能是容器宽或 stretch 后的宽）
      const availW = _w > 0 ? _w : intrinsicW;
      // 折行：按可用宽度切成多行
      const lines = wrapText(text, availW, { fontSize, fontFamily, fontWeight, letterSpacing });
      node._wrappedLines = lines;
      // 富文本 runs 也按行切分（保留样式），否则带 span 的 Text 不会折行、溢出容器
      node._wrappedRuns = runsByLines(text, lines, node._runs);
      // 盒高口径与 output.mjs 渲染对齐（2026-09-04 修复 flex 行内图标垂直错位）：
      //   output.mjs 对单行强制 lineSpacingMultiple=1.0 + anchor=top（PPT spcPct 单行会把 glyph 下移），
      //   glyph 顶对齐框顶 → 单行盒高若仍按 style.lineHeight 放大（如 15px×1.6×1.2=29px vs glyph 实际 ~18px），
      //   底部留白让 flex row alignItems:center 的图标/圆点相对虚高的大盒居中 → 视觉错位（case3 P11 实测 7px）。
      //   故：单行盒高 = glyph 行高（不含 lineHeight）；多行才按 lineHeight 撑开行距（与 PPT 多行 spcPct 一致）。
      const singleLine = lines.length <= 1;
      // 2026-09-04 修：多行高度不再统一用最大 fontSize——若为富文本（带 span），每行按该行 run 实际最大字号算行高再累加，
      // 否则小字行（如 34px 分钟）被按大字（130px）行高算 → 容器撑高（P5 "2分钟" 折行 2×156=312 的根因）。
      let height;
      if (singleLine) {
        height = measureLineHeight(fontSize, { lineHeight: 1.0 });
      } else if (node._wrappedRuns && node._wrappedRuns.length === lines.length) {
        height = 0;
        for (const lineRuns of node._wrappedRuns) {
          // 该行实际最大字号：先扫 run 拿首字号作基准（勿用顶层 fontSize——小字行无大字时会被大字基准高估），
          // 再取该行 run 的最大字号算行高（2026-09-04 P5 折行 2×156 根因：小字行按 130px 基准算）
          let maxFs = 0;
          for (const r of lineRuns) {
            const rs = (r && r.style) || {};
            let fs = 0;
            if (typeof rs.fontSize === 'number') fs = rs.fontSize;
            else if (typeof rs.fontSize === 'string') { const n = parseFloat(rs.fontSize); if (!Number.isNaN(n)) fs = n; }
            if (fs > maxFs) maxFs = fs;
          }
          // style 为 null 的纯文本 run 继承顶层字号（如 "2" 在 130px Text 内 style:null → 应算 130，不能当 0）
          for (const r of lineRuns) {
            const rs = (r && r.style) || {};
            const hasFs = typeof rs.fontSize === 'number' || (typeof rs.fontSize === 'string' && !Number.isNaN(parseFloat(rs.fontSize)));
            if (!hasFs) maxFs = Math.max(maxFs, fontSize);
          }
          if (maxFs <= 0) maxFs = fontSize; // 纯文本行（无字号 run）回退顶层字号
          height += measureLineHeight(maxFs, { lineHeight });
        }
      } else {
        height = lines.length * lineH;
      }
      // 关键：width 必须返回折行后的实际宽度（≤ availW），不能返回 intrinsicW 单行全宽。
      // 否则 yoga 认为 Text 需要超宽（> 容器），容器 justifyContent:center 时会把文本推到负坐标（溢出画布），
      // 且 Text 不会按容器宽度换行——这正是手绘卡（RoughBox+文本）里文本偏出框、负 x 坐标的根因。
      const wrapW = lines.reduce((m, l) => Math.max(m, measureWidth(l, { fontSize, fontFamily, fontWeight, letterSpacing })), 0);
      return { width: availW > 0 ? wrapW : intrinsicW, height };
    });
  } else if (node.type === 'FAIcon') {
    // FAIcon：默认 24px，读 style.width/height/fill
    const w = style.width || 24;
    const h = style.height || 24;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'Emoji') {
    // Emoji：同 FAIcon，默认 24px
    const w = style.width || 24;
    const h = style.height || 24;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'Table') {
    // Table：读 style.width/height（必填），否则给默认
    const w = style.width || 600;
    const h = style.height || 300;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'Chart') {
    // Chart：默认宽 100%（占满父容器），高度必填或默认
    const w = style.width || 800;
    const h = style.height || 400;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'svg') {
    // SVG：读 props 顶层 width/height（<svg width=.. height=..>）
    const w = (node.props && node.props.width) || 100;
    const h = (node.props && node.props.height) || 100;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'CodeBlock') {
    // CodeBlock：读 props 顶层 width（默认 700），高度按行数估算（fontSize 默认 12，行高 1.5）
    const w = (node.props && node.props.width) || 700;
    const code = (node.props && node.props.code) || '';
    const fontSize = (node.props && node.props.fontSize) || 12;
    const lines = code.split('\n').length;
    const macHeader = (node.props && node.props.macHeader) !== false;
    const h = lines * Math.ceil(fontSize * 1.5) + (macHeader ? 40 : 16) + 16;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'Math') {
    // Math：读 props 顶层 width/height（<Math latex width height>），默认 240×60
    const w = (node.props && node.props.width) || 240;
    const h = (node.props && node.props.height) || 60;
    yNode.setWidth(w);
    yNode.setHeight(h);
  } else if (node.type === 'QRCode') {
    // QRCode：读 style.width（默认 240），高=宽
    const w = style.width || 240;
    yNode.setWidth(w);
    yNode.setHeight(w);
  } else if (node.type === 'Shape') {
    // Shape：width/height 用 !== undefined 判断（width=0 是有意为之，如 line 画线），默认 100
    if (style.width !== undefined) yNode.setWidth(style.width);
    else yNode.setWidth(100);
    if (style.height !== undefined) yNode.setHeight(style.height);
    else yNode.setHeight(100);
  } else if (node.type === 'RoughBox') {
    // RoughBox：手绘图形，照抄 Shape 布局（width/height，可绝对定位）
    if (style.width !== undefined) yNode.setWidth(style.width);
    else yNode.setWidth(100);
    if (style.height !== undefined) yNode.setHeight(style.height);
    else yNode.setHeight(100);
  } else {
    // Image 等：默认尺寸（width=0 视为未指定，保持原语义）
    yNode.setHeight(style.height || 100);
    if (style.width) yNode.setWidth(style.width);
  }

  // 递归子节点：只处理真正的组件节点（跳过 span 富文本标记、number/boolean 原始类型）
  for (const c of node.children || []) {
    if (!isLayoutNode(c)) continue;
    const childY = buildYoga(c, yoga, theme);
    if (childY) yNode.insertChild(childY, yNode.getChildCount());
  }

  return yNode;
}

// 解析盒模型值：数字（四边同值）或字符串 CSS 简写（'10px' / '10px 16px' / '10px 16px 20px 24px'）
// 或语义 token（'lg' / 'lg md' / 'lg md xl xxl'）
// 返回 [top, right, bottom, left]；无法解析返回 null
function parseBoxValue(v) {
  if (typeof v === 'number') return [v, v, v, v];
  if (typeof v !== 'string') return null;
  // 先解析语义 token：把 'lg md' 拆成 [lg, md]，逐个 resolve 成数字
  const parts = v.trim().split(/\s+/).map((s) => {
    const resolved = resolveSpacing(s);
    return typeof resolved === 'number' ? resolved : parseFloat(resolved);
  });
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  // CSS 三值简写：top | left/right | bottom → [top, h, bottom, h]
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  if (parts.length === 4) return [parts[0], parts[1], parts[2], parts[3]];
  return null;
}

// 应用通用 style 属性：用映射表避免 if 森林，新增属性只需加一行
function applyStyle(yNode, style, yoga) {
  // 绝对定位：position:'absolute' + top/left/right/bottom
  if (style.position === 'absolute') {
    yNode.setPositionType(yoga.POSITION_TYPE_ABSOLUTE);
  }
  // padding / margin：支持数字（四边同值）与字符串 CSS 简写
  const pad = parseBoxValue(style.padding);
  if (pad) {
    yNode.setPadding(yoga.EDGE_TOP, pad[0]);
    yNode.setPadding(yoga.EDGE_RIGHT, pad[1]);
    yNode.setPadding(yoga.EDGE_BOTTOM, pad[2]);
    yNode.setPadding(yoga.EDGE_LEFT, pad[3]);
  }
  const mar = parseBoxValue(style.margin);
  if (mar) {
    yNode.setMargin(yoga.EDGE_TOP, mar[0]);
    yNode.setMargin(yoga.EDGE_RIGHT, mar[1]);
    yNode.setMargin(yoga.EDGE_BOTTOM, mar[2]);
    yNode.setMargin(yoga.EDGE_LEFT, mar[3]);
  }
  const setters = {
    paddingTop: (v) => yNode.setPadding(yoga.EDGE_TOP, resolveSpacing(v)),
    paddingBottom: (v) => yNode.setPadding(yoga.EDGE_BOTTOM, resolveSpacing(v)),
    paddingLeft: (v) => yNode.setPadding(yoga.EDGE_LEFT, resolveSpacing(v)),
    paddingRight: (v) => yNode.setPadding(yoga.EDGE_RIGHT, resolveSpacing(v)),
    marginTop: (v) => yNode.setMargin(yoga.EDGE_TOP, resolveSpacing(v)),
    marginBottom: (v) => yNode.setMargin(yoga.EDGE_BOTTOM, resolveSpacing(v)),
    marginLeft: (v) => yNode.setMargin(yoga.EDGE_LEFT, resolveSpacing(v)),
    marginRight: (v) => yNode.setMargin(yoga.EDGE_RIGHT, resolveSpacing(v)),
    // 绝对定位偏移（top/left/right/bottom）
    top: (v) => yNode.setPosition(yoga.EDGE_TOP, v),
    left: (v) => yNode.setPosition(yoga.EDGE_LEFT, v),
    right: (v) => yNode.setPosition(yoga.EDGE_RIGHT, v),
    bottom: (v) => yNode.setPosition(yoga.EDGE_BOTTOM, v),
    flexGrow: (v) => yNode.setFlexGrow(v),
    flexShrink: (v) => yNode.setFlexShrink(v),
    flexBasis: (v) => yNode.setFlexBasis(v),
    flex: (v) => yNode.setFlex(v),
    // 交叉轴单元素对齐 / 尺寸约束
    alignSelf: (v) => yNode.setAlignSelf(mapAlignSelf(v, yoga)),
    minWidth: (v) => yNode.setMinWidth(v),
    minHeight: (v) => yNode.setMinHeight(v),
    maxWidth: (v) => yNode.setMaxWidth(v),
    maxHeight: (v) => yNode.setMaxHeight(v),
  };

  for (const [key, setter] of Object.entries(setters)) {
    if (style[key] !== undefined) setter(style[key]);
  }
}

// 收集布局结果：getComputedLayout 返回相对父节点坐标，这里累加成绝对坐标
function collectLayout(node, parentX, parentY) {
  if (!node || typeof node !== 'object') return;
  const yNode = node.__yogaNode;
  if (yNode) {
    const l = yNode.getComputedLayout();
    node._layout = {
      x: parentX + l.left,
      y: parentY + l.top,
      width: l.width,
      height: l.height,
    };
  }
  const ax = node._layout ? node._layout.x : parentX;
  const ay = node._layout ? node._layout.y : parentY;
  for (const c of node.children || []) {
    if (!isLayoutNode(c)) continue;
    collectLayout(c, ax, ay);
  }
}

// 释放所有 Yoga 节点（先子后父，避免访问已释放的父节点）
function freeYogaNodes(node) {
  if (!node || typeof node !== 'object') return;
  for (const c of node.children || []) {
    if (!isLayoutNode(c)) continue;
    freeYogaNodes(c);
  }
  if (node.__yogaNode) {
    node.__yogaNode.free();
    node.__yogaNode = null;
  }
}

function mapFlexDirection(v, yoga) {
  return {
    column: yoga.FLEX_DIRECTION_COLUMN,
    row: yoga.FLEX_DIRECTION_ROW,
    'column-reverse': yoga.FLEX_DIRECTION_COLUMN_REVERSE,
    'row-reverse': yoga.FLEX_DIRECTION_ROW_REVERSE,
  }[v] || yoga.FLEX_DIRECTION_COLUMN;
}
function mapJustify(v, yoga) {
  return {
    'flex-start': yoga.JUSTIFY_FLEX_START,
    center: yoga.JUSTIFY_CENTER,
    'flex-end': yoga.JUSTIFY_FLEX_END,
    'space-between': yoga.JUSTIFY_SPACE_BETWEEN,
    'space-around': yoga.JUSTIFY_SPACE_AROUND,
    'space-evenly': yoga.JUSTIFY_SPACE_EVENLY,
  }[v] || yoga.JUSTIFY_FLEX_START;
}
function mapAlign(v, yoga) {
  return {
    'flex-start': yoga.ALIGN_FLEX_START,
    center: yoga.ALIGN_CENTER,
    'flex-end': yoga.ALIGN_FLEX_END,
    stretch: yoga.ALIGN_STRETCH,
  }[v] || yoga.ALIGN_FLEX_START;
}
function mapAlignSelf(v, yoga) {
  return {
    auto: yoga.ALIGN_AUTO,
    'flex-start': yoga.ALIGN_FLEX_START,
    center: yoga.ALIGN_CENTER,
    'flex-end': yoga.ALIGN_FLEX_END,
    stretch: yoga.ALIGN_STRETCH,
    baseline: yoga.ALIGN_BASELINE,
  }[v] || yoga.ALIGN_AUTO;
}
function mapFlexWrap(v, yoga) {
  return {
    nowrap: yoga.WRAP_NO_WRAP,
    wrap: yoga.WRAP_WRAP,
    'wrap-reverse': yoga.WRAP_WRAP_REVERSE,
  }[v] || yoga.WRAP_NO_WRAP;
}

// 判断一个子节点是否是「布局节点」（需要参与 Yoga 布局的组件）
// span（富文本标记）、br（换行）、number/boolean（表达式产物）都不是布局节点，跳过
// SVG 内部图形元素（g/line/circle/rect/path/polygon/ellipse）只走 serializeSvg → PNG，
// 不参与 flex 布局——若被当成 flex 子节点会被 column 拉伸、触发假溢出
const SVG_INNER_TYPES = new Set(['g', 'line', 'circle', 'rect', 'path', 'polygon', 'ellipse']);
function isLayoutNode(c) {
  if (c === null || c === undefined || typeof c !== 'object') return false;
  if (c.type === 'span' || c.type === 'br') return false;
  if (SVG_INNER_TYPES.has(c.type)) return false;
  return true;
}

function extractText(node) {
  // 递归提取所有文本（含 span 内的文字）；br 节点 → 换行符
  let out = '';
  for (const c of node.children || []) {
    if (typeof c === 'string') out += c;
    else if (c && typeof c === 'object' && c.type === 'br') out += '\n';
    else if (c && typeof c === 'object') out += extractText(c);
  }
  return out;
}

// 提取富文本 runs：把 children 拆成 [{text, style}] 列表
// 无 span 时返回 null（表示纯文本）；br → 换行符
function extractRuns(node) {
  const runs = [];
  let hasSpan = false;
  for (const c of node.children || []) {
    if (typeof c === 'string') {
      runs.push({ text: c, style: null });
    } else if (c && typeof c === 'object' && c.type === 'br') {
      hasSpan = true;
      runs.push({ text: '\n', style: null });
    } else if (c && typeof c === 'object' && c.type === 'span') {
      hasSpan = true;
      const text = extractText(c);
      runs.push({ text, style: (c.props && c.props.style) || {} });
    } else if (c && typeof c === 'object') {
      // 嵌套 Text（少见），递归
      hasSpan = true;
      runs.push({ text: extractText(c), style: (c.props && c.props.style) || {} });
    }
  }
  return hasSpan ? runs : null;
}

// 把折行后的行数组映射回 runs（每行 = [{text, style}] 片段数组，保留样式）
// lines 是 wrapText 按 availW 折出的行；runs 是原始富文本分段（null = 纯文本）
function runsByLines(fullText, lines, runs) {
  if (!runs || runs.length === 0) return null;
  const result = [];
  let pos = 0; // 全文游标
  // 预展开 runs 为字符级（带样式），便于按偏移切
  const chars = []; // {ch, style}
  for (const r of runs) {
    for (const ch of r.text) {
      chars.push({ ch, style: r.style });
    }
  }
  for (const line of lines) {
    const lineRuns = [];
    let consumed = 0;
    let curStyle = null;
    let buf = '';
    const flush = () => { if (buf) lineRuns.push({ text: buf, style: curStyle }); buf = ''; };
    while (consumed < line.length && pos < chars.length) {
      const { ch, style } = chars[pos];
      if (ch === '\n') { pos++; continue; }
      if (style !== curStyle) { flush(); curStyle = style; }
      buf += ch;
      pos++; consumed++;
    }
    flush();
    result.push(lineRuns);
  }
  return result;
}

export function dumpLayout(tree, indent = 0) {
  const pad = '  '.repeat(indent);
  const L = tree._layout;
  const text = tree._text !== undefined ? ` "${tree._text}"` : '';
  const lines = [`${pad}${tree.type} @ (${Math.round(L.x)}, ${Math.round(L.y)}) ${Math.round(L.width)}×${Math.round(L.height)}${text}`];
  for (const c of tree.children || []) {
    if (typeof c === 'string') continue;
    lines.push(dumpLayout(c, indent + 1));
  }
  return lines.join('\n');
}

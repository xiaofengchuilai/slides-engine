// 输出模块：布局结果 → pptxgenjs → .pptx
import PptxGenJS from 'pptxgenjs';
import { pxToInch, toPtFontSize } from './units.mjs';
import { CANVAS } from './layout.mjs';
import { getTheme, resolveColor, resolveFontSize, resolveRadius } from './theme.mjs';
import { resolve, isAbsolute, join } from 'node:path';
import { existsSync } from 'node:fs';
import { postProcessTxBox } from './postprocess.mjs';
import { getIconPng } from './icon.mjs';
import { getEmojiPng, emojiCodepoint } from './emoji.mjs';
import { mapChartType, convertChartData, mapBarDir } from './chart.mjs';
import { serializeSvg, svgToPngBase64 } from './svg.mjs';
import { getQrPng } from './qrcode.mjs';
import { parseLinearGradient, gradientTag } from './gradient.mjs';
import { texToSvg } from './math.mjs';
import { clipImageToPng } from './clip.mjs';
import { codeToPng } from './codeblock.mjs';
import { roughSvg } from './rough.mjs';

// render 接受单页 tree 或 trees 数组（多页）
// baseDir：Image src 的相对路径基准（默认 cwd）
export async function render(trees, outPath, { theme = 'business', baseDir = process.cwd() } = {}) {
  const list = Array.isArray(trees) ? trees : [trees];
  const t = getTheme(theme);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDE', width: CANVAS.width / 96, height: CANVAS.height / 96 });
  pptx.layout = 'SLIDE';

  for (const tree of list) {
    const slide = pptx.addSlide();
    slide.background = { color: toHex(t.colors.bg) };
    const ctx = { slide, theme: t, baseDir, pptx };
    await walk(tree, ctx);
  }

  await pptx.writeFile({ fileName: outPath });
  // 后处理：给文本 shape 加 txBox="1" 文本框标记（缺少时部分预览器渲染错乱）
  await postProcessTxBox(outPath);
  return outPath;
}

// ── 渲染器注册表：每个组件类型一个渲染函数，walk 只负责遍历 + 查表分发 ──

const renderers = {
  Slide: renderSlide,
  Box: renderBox,
  Text: renderText,
  Image: renderImage,
  FAIcon: renderFAIcon,
  Emoji: renderEmoji,
  Table: renderTable,
  Chart: renderChart,
  Shape: renderShape,
  RoughBox: renderRoughBox,
  svg: renderSvg,
  QRCode: renderQRCode,
  Math: renderMath,
  CodeBlock: renderCodeBlock,
};

// 树遍历：取布局 → 查表分发 → 递归子节点
async function walk(node, ctx) {
  if (!node || typeof node !== 'object') return;
  const L = node._layout;
  if (!L) return;

  const renderer = renderers[node.type];
  if (renderer) {
    await renderer(node, ctx);
  }

  for (const c of node.children || []) {
    if (c === null || typeof c !== 'object') continue;
    await walk(c, ctx);
  }
}

// ── 各组件渲染函数（ctx = { slide, theme, baseDir, pptx }）──

function renderSlide(node, ctx) {
  const { slide, theme } = ctx;
  const style = (node.props && node.props.style) || {};
  // Slide 的 background 会覆盖 render() 里默认的 theme.bg（此前被静默忽略，导致封面/章节页白底）
  // 注意：pptxgenjs 的 slide.background 仅支持纯色（genXmlColorSelection 只处理 solid），
  //      渐变背景请用 Slide 内层 position:absolute 的全屏 Box 实现（Box 有完整渐变链路）。
  //      这里对渐变做降级：取第一个停靠点颜色，避免白底而非强行生成不生效的渐变标记。
  if (style.background) {
    const grad = typeof style.background === 'string' ? parseLinearGradient(style.background) : null;
    // 渐变降级取第一停靠色：若为语义 token 需先解析（否则文本框会拿到 token 名当颜色）
    if (grad) resolveGradTokens(grad, theme);
    const fillColor = grad ? grad.stops[0].color : toHex(resolveColor(style.background, theme));
    slide.background = { color: fillColor };
  }
}

function renderBox(node, ctx) {
  const { slide, theme } = ctx;
  const style = (node.props && node.props.style) || {};
  const L = node._layout;
  // 兜底：0/负尺寸容器（空装饰元素塌缩）不输出任何 shape——
  // 0×0 shape 或 borderRadius 的 adj=Infinity 会生成非法 OOXML（PowerPoint 报「内容有问题」）。
  // Box 不应输出任何 0 高/0 宽形状（横向分隔线请用 Shape type="line"，见 component 文档）
  if (!L || L.width <= 0 || L.height <= 0) return;
  if (style.background) {
    const fill = resolveFill(style.background, theme);
    const fillProps = { color: fill.color };
    // opacity(0-1) / rgba alpha → transparency(0-100)：pptxgenjs 的 fill 对象内识别 transparency（源码 848 行）
    const op = typeof style.opacity === 'number' ? Math.round((1 - style.opacity) * 100) : null;
    const tr = fill.transparency !== null ? fill.transparency : null;
    let transparency = tr !== null && op !== null ? Math.max(tr, op) : (tr !== null ? tr : op);
    if (transparency !== null && transparency !== undefined && transparency > 0) fillProps.transparency = transparency;
    const rectOpts = {
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
      fill: fillProps,
    };
    if (fill.grad) {
      rectOpts.objectName = gradientTag(fill.grad.angle, fill.grad.stops);
    }
    const minSide = Math.min(L.width, L.height);
    // 兜底：0/负尺寸容器会把圆角 adj 算成 Infinity，生成非法 OOXML（PowerPoint 报「内容有问题」）
    // → 退化为直角矩形（roundRect 只在尺寸有效时用）
    const shapeName = style.borderRadius && minSide > 0 ? 'roundRect' : 'rect';
    if (style.borderRadius && minSide > 0) {
      const r = resolveRadius(style.borderRadius);
      // rectRadius ∈ (0,1]，过小时钳制下限避免 pptxgenjs 写出异常值
      rectOpts.rectRadius = Math.min(1, Math.max(0.01, r / minSide));
    }
    if (style.border) {
      const [w, , color] = parseBorder(style.border);
      if (color) rectOpts.line = { color: toHex(resolveColor(color, theme)), width: w / 96 };
    }
    // boxShadow 标准实现：单条外阴影
    if (style.boxShadow) {
      const sh = parseBoxShadow(style.boxShadow);
      if (sh) rectOpts.shadow = sh;
    }
    // 旋转：pptxgenjs 以中心为轴
    if (typeof style.rotate === 'number' && style.rotate !== 0) {
      rectOpts.rotate = style.rotate;
    }
    slide.addShape(shapeName, rectOpts);
  }
}

function renderText(node, ctx) {
  const { slide, theme } = ctx;
  const style = (node.props && node.props.style) || {};
  const L = node._layout;
  const opts = {
    x: pxToInch(L.x),
    y: pxToInch(L.y),
    w: pxToInch(L.width),
    h: pxToInch(L.height),
    fit: 'none',
    wrap: false, // 不自动换行（文本为精确定位，不能被 PPT 二次拆断）
    margin: 0,   // 文本框内边距=0（写 lIns/tIns/rIns/bIns="0"，否则默认内边距会挤压文本）
    valign: 'top', // 顶部对齐（不设 anchor，取默认 top）
  };
  // 渐变文字：backgroundClip='text' + backgroundImage → objectName 标记，后处理替换 run 的 solidFill 为 gradFill
  let textGrad = null;
  if (style.backgroundClip === 'text' && typeof style.backgroundImage === 'string') {
    textGrad = parseLinearGradient(style.backgroundImage);
    if (textGrad) {
      resolveGradTokens(textGrad, theme); // 语义 token → hex（同 resolveFill，名字通道只接受 hex）
      opts.objectName = 'TXTGRAD_' + gradientTag(textGrad.angle, textGrad.stops).slice(5);
    }
  }
  if (style.fontSize) opts.fontSize = toPtFontSize(resolveFontSize(style.fontSize));
  if (style.color) opts.color = toHex(resolveColor(style.color, theme));
  else opts.color = toHex(theme.colors.text); // 默认用主题文本色
  if (typeof style.opacity === 'number') opts.transparency = Math.round((1 - style.opacity) * 100);
  if (node._fontFamily) opts.fontFace = node._fontFamily; // 主题字体
  // 行距：所有文本统一设 spcPct=100000（100% 行距），等价于始终设置 lineSpacingMultiple。
  // 注意：单行文本不能设 >1.0 的 spcPct——PPT 的 spcPct 作用于行框，单行时行框 > 字形高会把
  // glyph 在行框内下移（实测 lineHeight 1.6 单行文字比 1.0 下移 ~6px），导致同一 flex row 里
  // 「标签(1.0) + 正文(1.6)」上下错位（实例 content/business/1532 战略目标行）。多行才需要
  // lineHeight 控制行距；单行设 1.0 无行距损失（没有第二行），glyph 顶对齐框顶。
  const wrappedLines = node._wrappedLines && node._wrappedLines.length > 1;
  const wrappedRuns = node._wrappedRuns && node._wrappedRuns.length > 1;
  opts.lineSpacingMultiple = (wrappedLines || wrappedRuns) ? (node._lineHeight || 1.0) : 1.0;
  if (style.bold) opts.bold = true;
  if (style.fontWeight && !style.bold) {
    // fontWeight 数值（100-900）降级为两档：≥600 视为 bold（pptxgenjs 无原生数值字重）
    const fw = typeof style.fontWeight === 'number' ? style.fontWeight : 0;
    opts.bold = fw >= 600 || style.fontWeight === 'bold';
  }
  // textDecoration: 'line-through' → strike
  if (style.textDecoration === 'line-through') opts.strike = true;
  // 对齐 / 字间距 / 换行 / 超链接 / 阴影
  if (style.textAlign) opts.align = style.textAlign;
  if (style.letterSpacing !== undefined) opts.charSpacing = style.letterSpacing;
  if (node.props && node.props.href) {
    opts.hyperlink = { url: node.props.href };
  }
  if (style.textShadow) {
    opts.shadow = parseTextShadow(style.textShadow);
  }
  // 旋转：pptxgenjs 以中心为轴（和 CSS 左上角不同，回填模板时注意换算）
  if (typeof style.rotate === 'number' && style.rotate !== 0) {
    opts.rotate = style.rotate;
  }

  if (node._runs) {
    // 富文本：若 layout 已折行（_wrappedRuns），按行渲染（行末 run 追加 \n 换行，保留各 run 样式）
    let textArray;
    if (node._wrappedRuns && node._wrappedRuns.length > 1) {
      textArray = [];
      node._wrappedRuns.forEach((lineRuns, li) => {
        const last = li === node._wrappedRuns.length - 1;
        lineRuns.forEach((r, ri) => {
          const runOpts = {};
          if (style.fontSize) runOpts.fontSize = toPtFontSize(resolveFontSize(style.fontSize));
          if (style.color) runOpts.color = toHex(resolveColor(style.color, theme));
          else runOpts.color = toHex(theme.colors.text);
          if (node._fontFamily) runOpts.fontFace = node._fontFamily;
          if (style.bold) runOpts.bold = true;
          if (r.style) {
            if (r.style.color) runOpts.color = toHex(resolveColor(r.style.color, theme));
            if (r.style.fontWeight === 'bold' || r.style.bold) runOpts.bold = true;
            if (r.style.textDecoration === 'underline') runOpts.underline = true;
          }
          const isLineEnd = ri === lineRuns.length - 1;
          textArray.push({ text: r.text + (!last && isLineEnd ? '\n' : ''), options: runOpts });
        });
      });
    } else {
      textArray = node._runs.map((r) => {
        const runOpts = {};
        if (style.fontSize) runOpts.fontSize = toPtFontSize(resolveFontSize(style.fontSize));
        if (style.color) runOpts.color = toHex(resolveColor(style.color, theme));
        else runOpts.color = toHex(theme.colors.text);
        if (node._fontFamily) runOpts.fontFace = node._fontFamily;
        if (style.bold) runOpts.bold = true;
        if (r.style) {
          if (r.style.color) runOpts.color = toHex(resolveColor(r.style.color, theme));
          if (r.style.fontWeight === 'bold' || r.style.bold) runOpts.bold = true;
          if (r.style.textDecoration === 'underline') runOpts.underline = true;
        }
        return { text: r.text, options: runOpts };
      });
    }
    slide.addText(textArray, opts);
  } else {
    // 纯文本：若 layout 已折行，用 \n 拼接（wrap:false 下 \n 仍会换行，不会二次折行）
    let text = node._text || '';
    if (node._wrappedLines && node._wrappedLines.length > 1) {
      text = node._wrappedLines.join('\n');
    }
    slide.addText(text, opts);
  }
}

async function renderImage(node, ctx) {
  const { slide, baseDir } = ctx;
  const src = node.props && node.props.src;
  const L = node._layout;
  const style = (node.props && node.props.style) || {};
  if (src) {
    const imgPath = isAbsolute(src) ? src : resolve(baseDir, src);
    // 文件不存在兑底：跳过 + warning（不崩）。对齐图片流水线——无图页删 Image，但有遗漏时不让编译崩
    if (!existsSync(imgPath)) {
      console.warn(`⚠ Image 文件不存在，已跳过: ${imgPath}`);
      return;
    }
    // clipPath：圆形/椭圆预裁剪（canvas 裁成透明 PNG）
    let useData = null;
    if (style.clipPath) {
      const clipped = await clipImageToPng(imgPath, style.clipPath);
      if (clipped) {
        useData = 'data:image/png;base64,' + clipped.toString('base64');
      }
    }
    const opts = {
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    };
    if (useData) opts.data = useData;
    else opts.path = imgPath;
    // objectFit: cover/contain → sizing（crop 裁切填满 / 完整显示）
    if (style.objectFit === 'cover' || style.objectFit === 'contain') {
      opts.sizing = {
        type: style.objectFit,
        w: pxToInch(L.width),
        h: pxToInch(L.height),
      };
    }
    slide.addImage(opts);
  }
}

async function renderFAIcon(node, ctx) {
  const { slide, theme } = ctx;
  const style = (node.props && node.props.style) || {};
  const L = node._layout;
  const name = node.props && node.props.name;
  const fill = style.fill ? resolveColor(style.fill, theme) : theme.colors.text;
  const pngBuf = await getIconPng(name, fill);
  if (pngBuf) {
    slide.addImage({
      data: pngBuf,
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    });
  } else {
    console.warn(`⚠ FAIcon 图标 "${name}" 未找到或渲染失败`);
  }
}

async function renderEmoji(node, ctx) {
  const { slide } = ctx;
  const style = (node.props && node.props.style) || {};
  const L = node._layout;
  const emoji = node.props && node.props.name;
  const pngData = getEmojiPng(emoji);
  if (pngData) {
    slide.addImage({
      data: pngData,
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    });
  } else {
    console.warn(`⚠ Emoji "${emoji}" 无本地资源（${emojiCodepoint(emoji)}），已跳过`);
  }
}

function renderTable(node, ctx) {
  const { slide, theme } = ctx;
  const L = node._layout;
  const cells = node.props && node.props.cells;
  if (Array.isArray(cells) && cells.length > 0) {
    const rows = cells.map((row) =>
      row.map((cell) => {
        // 单元格可能是字符串或 {text, textStyle, cellStyle}
        if (typeof cell === 'string') return { text: cell };
        const c = cell || {};
        const opts = {};
        if (c.textStyle) {
          if (c.textStyle.bold) opts.bold = true;
          if (c.textStyle.color) opts.color = toHex(resolveColor(c.textStyle.color, theme));
          if (c.textStyle.fontSize) opts.fontSize = toPtFontSize(resolveFontSize(c.textStyle.fontSize));
          if (c.textStyle.fontFace) opts.fontFace = c.textStyle.fontFace;
        }
        if (c.cellStyle && c.cellStyle.background) {
          opts.fill = { color: toHex(resolveColor(c.cellStyle.background.color, theme)) };
        }
        return { text: c.text || '', options: opts };
      })
    );
    slide.addTable(rows, {
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    });
  }
}

function renderChart(node, ctx) {
  const { slide, theme, pptx } = ctx;
  const L = node._layout;
  const chartType = node.props && node.props.chartType;
  const data = node.props && node.props.data;
  const chartKey = mapChartType(chartType);
  if (chartKey && pptx.ChartType[chartKey] && Array.isArray(data)) {
    const chartData = convertChartData(data);
    const opts = {
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    };
    if (node.props.title) {
      opts.title = node.props.title;
      opts.showTitle = true; // pptxgenjs 默认不显示标题，需显式开启
    }
    if (chartKey === 'bar' && node.props.barDirection) {
      opts.barDir = mapBarDir(node.props.barDirection);
    }
    if (node.props.showLegend === false) opts.showLegend = false;
    else {
      opts.showLegend = true; // 默认显示图例
      opts.legendPos = 'b';   // 图例固定在底部（不是右边），保证各预览器一致
    }
    if (node.props.showDataLabels === true) {
      opts.showLabel = true;
      opts.showValue = true; // 数据标签显示数值
    }
    // 类别轴标签频率：强制每个类别都显示（否则预览器可能只显示部分/序号）
    opts.catAxisLabelFrequency = '1';
    if (Array.isArray(node.props.colors)) {
      opts.chartColors = node.props.colors.map((c) => toHex(resolveColor(c, theme)));
    }
    slide.addChart(pptx.ChartType[chartKey], chartData, opts);
  } else {
    console.warn(`⚠ Chart 类型 "${chartType}" 不支持或 data 为空`);
  }
}

function renderShape(node, ctx) {
  const { slide, theme, pptx } = ctx;
  const style = (node.props && node.props.style) || {};
  const L = node._layout;
  // 兜底：0/负尺寸不输出（非法 OOXML 风险同上）。
  // 例外：ShapeType.line/rightArrow 等横向形状 height 天然为 0（引擎规范「line 是横向预设形状，
  // height 应设 0」），仅当宽高**都为 0** 或出现负值时跳过。
  if (!L || (L.width <= 0 && L.height <= 0) || L.width < 0 || L.height < 0) return;
  const shapeName = node.props && node.props.type;
  if (shapeName && pptx.ShapeType[shapeName]) {
    const opts = {
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    };
    // 填充色
    if (style.fill) {
      opts.fill = { color: toHex(resolveColor(style.fill, theme)) };
    } else if (style.background) {
      opts.fill = { color: toHex(resolveColor(style.background, theme)) };
    }
    // 描边 / 连接线
    if (style.line) {
      const ln = style.line;
      opts.line = {};
      if (ln.color) opts.line.color = toHex(resolveColor(ln.color, theme));
      if (ln.width) opts.line.width = ln.width;
      if (ln.dashType) opts.line.dashType = ln.dashType;
      if (ln.endArrowType) opts.line.endArrowType = ln.endArrowType;
      if (ln.beginArrowType) opts.line.beginArrowType = ln.beginArrowType;
    }
    // 圆角矩形半径
    if (style.borderRadius) opts.rectRadius = resolveRadius(style.borderRadius) / 100;
    // 旋转
    if (style.rotate) opts.rotate = style.rotate;
    // boxShadow 标准实现：单条外阴影
    if (style.boxShadow) {
      const sh = parseBoxShadow(style.boxShadow);
      if (sh) opts.shadow = sh;
    }
    slide.addShape(pptx.ShapeType[shapeName], opts);
  } else {
    console.warn(`⚠ Shape 类型 "${shapeName}" 不支持`);
  }
}

async function renderRoughBox(node, ctx) {
  const { slide, theme } = ctx;
  const props = (node.props && node.props) || {};
  const style = props.style || {};
  const L = node._layout;
  // 兜底：0/负尺寸不渲染（RoughBox 转 PNG 时 0 尺寸会异常）
  if (!L || L.width <= 0 || L.height <= 0) return;
  const shapeName = props.shape || 'rect';

  // 组装 rough 参数（style 里放视觉参数，props 里放形状几何参数）
  // 注意：SVG 颜色需要 #RRGGBB 格式，toHex 返回不带 # 的 hex，这里补回 #
  const hexWithHash = (v) => (v ? '#' + toHex(resolveColor(v, theme)) : null);
  // circle/ellipse 的 x/y 是中心坐标，居中放
  const isCenterShape = shapeName === 'circle' || shapeName === 'ellipse';
  const roughOpts = {
    shape: shapeName,
    x: isCenterShape ? L.width / 2 : 0,
    y: isCenterShape ? L.height / 2 : 0,
    width: L.width,
    height: L.height,
    diameter: Math.min(L.width, L.height),
    path: props.path,
    points: props.points,
    x2: props.x2, y2: props.y2,
    stroke: hexWithHash(style.stroke) || '#000000',
    strokeWidth: style.strokeWidth || 2,
    roughness: style.roughness !== undefined ? style.roughness : 1.5,
    bowing: style.bowing !== undefined ? style.bowing : 2,
    fill: hexWithHash(style.fill) || 'none',
    fillStyle: style.fillStyle || 'hachure',
    fillWeight: style.fillWeight,
    seed: style.seed !== undefined ? style.seed : undefined,
    dash: style.dash,
  };

  const svgStr = roughSvg(roughOpts);
  if (!svgStr) { console.warn(`⚠ RoughBox "${shapeName}" 生成失败`); return; }
  const pngData = await svgToPngBase64(svgStr);
  if (!pngData) { console.warn(`⚠ RoughBox "${shapeName}" SVG→PNG 失败`); return; }
  const dbg = Buffer.from(pngData.split(',')[1], 'base64');
  console.log(`[RoughBox] ${shapeName} L=${JSON.stringify(L)} PNG=${dbg.length}B`);

  // 渲染时 +10px pad（SVG canvas 预留手绘抖动空间）。若 pad 后越界画布则裁剪 pad，保证主体不越界
  const pad = 10;
  let imgX = L.x - pad;
  let imgY = L.y - pad;
  let imgW = L.width + pad * 2;
  let imgH = L.height + pad * 2;
  // 右/下越界：收窄宽度/高度（保主体）
  if (imgX + imgW > CANVAS.width) imgW = CANVAS.width - imgX;
  if (imgY + imgH > CANVAS.height) imgH = CANVAS.height - imgY;
  // 左/上越界（极端情况）：平移回画布内
  if (imgX < 0) { imgW += imgX; imgX = 0; }
  if (imgY < 0) { imgH += imgY; imgY = 0; }
  if (imgW <= 0 || imgH <= 0) { console.warn(`⚠ RoughBox "${shapeName}" 越界无法裁剪，跳过`); return; }
  slide.addImage({
    x: pxToInch(imgX),
    y: pxToInch(imgY),
    w: pxToInch(imgW),
    h: pxToInch(imgH),
    data: pngData,
  });
}

async function renderSvg(node, ctx) {
  const { slide } = ctx;
  const L = node._layout;
  const svgString = serializeSvg(node);
  const pngData = await svgToPngBase64(svgString);
  if (pngData) {
    slide.addImage({
      data: pngData,
      x: pxToInch(L.x),
      y: pxToInch(L.y),
      w: pxToInch(L.width),
      h: pxToInch(L.height),
    });
  }
}

async function renderQRCode(node, ctx) {
  const { slide } = ctx;
  const L = node._layout;
  const text = node.props && node.props.text;
  if (text) {
    const pngData = await getQrPng(text, { width: Math.round(L.width) });
    if (pngData) {
      slide.addImage({
        data: pngData,
        x: pxToInch(L.x),
        y: pxToInch(L.y),
        w: pxToInch(L.width),
        h: pxToInch(L.height),
      });
    }
  } else {
    console.warn('⚠ QRCode 缺少 text 属性');
  }
}

// ── 辅助函数 ──

// 解析 boxShadow（标准单条外阴影）：'offsetX offsetY blur color' → pptxgenjs ShadowProps
// 复用 parseTextShadow 的解析逻辑（返回结构兼容 ShadowProps）
function parseBoxShadow(shadow) {
  return parseTextShadow(shadow);
}

// 解析 textShadow：'2px 2px 8px rgba(0,0,0,0.3)' → pptxgenjs shadow props
function parseTextShadow(shadow) {
  if (typeof shadow !== 'string') return null;
  // 格式：offsetX offsetY blur color（offsetX 可为 0 省略 px，offsetY/blur 必须带 px）
  const m = shadow.match(/([\d.-]+)(?:px)?\s+([\d.-]+)px\s+([\d.]+)px\s+(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
  if (!m) return null;
  const offsetX = parseFloat(m[1]);
  const offsetY = parseFloat(m[2]);
  const blur = parseFloat(m[3]);
  const colorStr = m[4];
  let color = '000000';
  let opacity = 0.3;
  if (colorStr.startsWith('#')) {
    color = toHex(colorStr);
  } else {
    const rgba = colorStr.match(/rgba?\(([^)]+)\)/);
    if (rgba) {
      const parts = rgba[1].split(',').map((s) => s.trim());
      color = toHex(`#${parts.slice(0, 3).map((p) => parseInt(p).toString(16).padStart(2, '0')).join('')}`);
      if (parts[3] !== undefined) opacity = parseFloat(parts[3]);
    }
  }
  return {
    type: 'outer',
    color,
    opacity,
    blur: blur / 96, // px → pt
    offset: Math.max(Math.abs(offsetX), Math.abs(offsetY)) / 96,
    angle: Math.atan2(offsetY, offsetX) * (180 / Math.PI),
  };
}

// 把 '#RRGGBB' / '#RGB' / 'rgb(r,g,b)' / 'rgba(r,g,b,a)' 转成 pptxgenjs 的 6 位 'RRGGBB'
// rgba 的 alpha 通道被丢弃（opacity 应单独用 style.opacity 表达），RGB 前三通道被正确提取
function toHex(color) {
  if (!color) return '000000';
  // rgb()/rgba()：提取前三个数字通道，各自转 hex 拼成 6 位
  const rgbMatch = String(color).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgbMatch) {
    return [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  let hex = String(color).startsWith('#') ? String(color).slice(1) : String(color).replace(/[^0-9a-fA-F]/g, '');
  // 3 位缩写 → 6 位
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  return hex.padEnd(6, '0').slice(0, 6).toUpperCase();
}

// 解析 rgba() 的 alpha（0-1），非 rgba 或 alpha>=1 返回 null
function rgbaAlpha(color) {
  if (typeof color !== 'string' || !color.toLowerCase().includes('rgba')) return null;
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return null;
  const a = parseFloat(m[4]);
  return Number.isFinite(a) && a < 1 ? a : null;
}

// 【语义色】把渐变 stop 里的语义 token 就地解析成实际 hex。
// 为何要提前解析：渐变靠 shape 名字（GRAD_角度_色1_色2）传到 postprocess，
// 名字正则只接受 hex 字符，token 名（如 PRIMARY）传不过去。此处解析既让 token 生效，又不动 postprocess 链路。
// 解析失败（未知 token / theme 缺失）则保留原值，由下游自然降级。
function resolveGradTokens(grad, theme) {
  if (!grad || !theme) return grad;
  for (const s of grad.stops) {
    if (!s.token) continue;
    const resolved = resolveColor(s.color, theme);
    const hex6 = typeof resolved === 'string' ? resolved.replace('#', '').toUpperCase() : null;
    if (/^[0-9A-F]{6}$/.test(hex6 || '')) { s.color = hex6; s.token = false; }
  }
  return grad;
}

// 背景色解析：返回 { color: hex, transparency: 0-100 | null, grad }
// 支持 rgba() alpha → 透明度，解决 rgba 背景被渲染成完全不透明的问题（如 rgba(68,187,164,0.15) 装饰圆）
// 【2026-09-11】渐变降级为单色时，若首停靠点带 alpha（rgba 端点），同样要转成 transparency，
//   否则半透明渐变会被当成不透明色渲染（如全屏 rgba 覆盖层把底下的深蓝盖死）。
function resolveFill(background, theme) {
  const grad = typeof background === 'string' ? parseLinearGradient(background) : null;
  resolveGradTokens(grad, theme);
  const color = grad ? grad.stops[0].color : background;
  const hex = toHex(resolveColor(color, theme));
  // alpha 优先取停靠点自带的（rgba 端点），否则从原字符串解析（单色 rgba）
  const stopAlpha = grad && typeof grad.stops[0].alpha === 'number' ? grad.stops[0].alpha : null;
  const alpha = stopAlpha !== null ? stopAlpha : rgbaAlpha(color);
  return {
    color: hex,
    transparency: alpha !== null ? Math.round((1 - alpha) * 100) : null,
    grad,
  };
}

// 解析 '2px solid #333' 形式的 border
function parseBorder(border) {
  if (typeof border !== 'string') return [];
  const m = border.match(/([\d.]+)px\s+(\w+)\s+(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|[a-zA-Z]+)/);
  if (!m) return [];
  return [parseFloat(m[1]), m[2], m[3]];
}


async function renderMath(node, ctx) {
  const { slide } = ctx;
  const L = node._layout;
  const latex = (node.props && node.props.latex) || '';
  const color = (node.props && node.props.color) || '#000000';
  const display = (node.props && node.props.display) === true;
  if (!latex) { console.warn('⚠ Math 缺少 latex'); return; }
  const svg = texToSvg(latex, { color, display });
  if (!svg) return;
  const pngData = await svgToPngBase64(svg);
  if (!pngData) return;
  slide.addImage({
    data: pngData,
    x: pxToInch(L.x),
    y: pxToInch(L.y),
    w: pxToInch(L.width),
    h: pxToInch(L.height),
  });
}


async function renderCodeBlock(node, ctx) {
  const { slide } = ctx;
  const L = node._layout;
  const code = (node.props && node.props.code) || '';
  const lang = (node.props && node.props.language) || 'javascript';
  const theme = (node.props && node.props.theme) || 'github-dark';
  const fontSize = (node.props && node.props.fontSize) || 12;
  const macHeader = (node.props && node.props.macHeader) !== false;
  const background = (node.props && node.props.background) || null;
  if (!code) { console.warn('⚠ CodeBlock 缺少 code'); return; }
  const pngBuf = await codeToPng(code, { lang, theme, fontSize, macHeader, background });
  if (!pngBuf) return;
  slide.addImage({
    data: 'data:image/png;base64,' + pngBuf.toString('base64'),
    x: pxToInch(L.x),
    y: pxToInch(L.y),
    w: pxToInch(L.width),
    h: pxToInch(L.height),
  });
}

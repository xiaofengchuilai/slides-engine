// 校验模块：跑语法 + 资源完整性校验
// 职责：只查机器能判定的违规（语法错误/图标名不存在/图片占位符/溢出画布/组件参数缺失），
//       不查设计审美（密度/锚点/Action Title 靠动笔自检+视觉模型）。
import { executeSlide } from './runtime.mjs';
import { layout, CANVAS } from './layout.mjs';
import { hasIcon } from './icon-names.mjs';
import { readFileSync } from 'node:fs';
import { collectSlideFiles } from './files.mjs';
import { resolveColor, getTheme } from './theme.mjs';

// ── 可读性对比度工具（WCAG 2.x 相对亮度/对比度）──
// 背景：引擎允许任意 hex 与语义 token，生成时 LLM 易在浅底上配浅字、深底上配深字（肉眼难察、视觉验收默认关时漏出）。
// validate 加硬校验：Text/span 显式 color 与其所在容器背景对比度 < 4.5:1（正文标准）报 error，拦截低级配色错误。
function hexToRgb(hex) {
  let h = String(hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToLum(rgb) {
  if (!rgb) return 0;
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
// 解析任意颜色值（hex/rgb()/rgba()/语义 token）→ [r,g,b]，失败返回 null
function parseColorAny(value, theme) {
  if (value == null) return null;
  const v = String(value).trim();
  // 线性渐变：取首端颜色作背景代表（渐变首色通常是主体/最深端；两端都是深色或首深尾浅时首色接近实际观感）。
  // 完全拿不准两端差异大时首色偏保守（若首深尾浅，文字若按首色判可读实际渐变尾端可能更浅——但 deck 深底白字主场景下首色即深端，成立）。
  if (v.startsWith('linear-gradient')) {
    // 取渐变里第一个真实颜色（#hex 或 rgb()）作背景代表——避开角度/位置词（180deg 含 \w 会被误捕获）
    const m = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/.exec(v);
    if (m) {
      const first = parseColorAny(m[1], theme);
      if (first) return first;
    }
  }
  // rgba/rgb：取前 3 通道（alpha 对同底色影响小，保守忽略；若 alpha 很低说明设计上可能叠深蒙版，交给视觉，不硬判）
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  // 语义 token / hex
  const resolved = resolveColor(v, typeof theme === 'string' ? getTheme(theme) : theme);
  if (/^#/.test(resolved)) {
    const c = hexToRgb(resolved);
    if (c) return c;
  }
  return null;
}
function contrastRatio(a, b) {
  const la = rgbToLum(a), lb = rgbToLum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// ── style 属性白名单（与 layout.mjs / output.mjs 实际实现保持一致）──
// 分「通用属性」（applyStyle 对所有组件生效）与「组件专属属性」。
// 未知属性会静默失效，故 validate 时对不在白名单内的属性报 warning，提示生成者核对。

const COMMON_STYLE = [
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'top', 'left', 'right', 'bottom', 'position',
  'flexGrow', 'flexShrink', 'flexBasis', 'flex',
  'alignSelf', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'width', 'height', 'opacity',
];

const COMPONENT_STYLE = {
  Box: ['flexDirection', 'justifyContent', 'alignItems', 'flexWrap', 'gap', 'background', 'border', 'borderRadius', 'boxShadow', 'display', 'rotate'],
  Text: ['fontSize', 'color', 'bold', 'fontWeight', 'lineHeight', 'textAlign', 'letterSpacing', 'textShadow', 'textDecoration', 'fontFamily', 'backgroundClip', 'backgroundImage', 'whiteSpace', 'overflow', 'textOverflow', 'rotate'],
  span: ['fontSize', 'color', 'bold', 'fontWeight', 'letterSpacing', 'textDecoration', 'fontFamily', 'opacity'],
  Image: ['objectFit', 'clipPath'],
  FAIcon: ['fill'],
  Emoji: [],
  Shape: ['fill', 'background', 'line', 'borderRadius', 'rotate', 'boxShadow'],
  RoughBox: ['stroke', 'strokeWidth', 'roughness', 'bowing', 'fill', 'fillStyle', 'fillWeight', 'seed', 'dash'],
  Table: [],
  Chart: [],
  QRCode: [],
  svg: [],
  Math: [],
  CodeBlock: [],
  Slide: ['background'],
};

function validateStyleProps(node, ctx) {
  const style = (node.props && node.props.style) || {};
  if (typeof style !== 'object' || style === null) return;
  const allowed = new Set([...COMMON_STYLE, ...(COMPONENT_STYLE[node.type] || [])]);
  for (const key of Object.keys(style)) {
    if (!allowed.has(key)) {
      ctx.warnings.push(`${ctx.tag}: 组件 ${node.type} 使用了 style 属性 "${key}"，引擎暂不支持（会被静默忽略），请核对 engine-capabilities.md`);
    }
  }
  // 属性值层面的硬性限制：display 仅支持 flex（见 component-box 的硬限制）
  if (node.type === 'Box' && style.display && style.display !== 'flex') {
    ctx.warnings.push(`${ctx.tag}: Box 仅支持 display:'flex'，收到 "${style.display}"（grid/table 等不支持，会被忽略）`);
  }
  // padding/margin 值形态校验：非数字时必须能按 1/2/3/4 值 CSS 简写解析。
  // 解析失败（如 '100px 70 0 5px 2px' 五值、'abc'、'calc(100px)'）→ 引擎会静默丢弃整个 padding/margin，
  // 页面布局将错乱且无报错。validate 提前 warning，避免"布局莫名不对"。
  for (const key of ['padding', 'margin']) {
    const v = style[key];
    if (v === undefined || typeof v === 'number') continue;
    if (typeof v !== 'string') {
      ctx.warnings.push(`${ctx.tag}: ${key} 值 "${String(v)}" 类型不支持（应为数字或 'a b c d' 简写字符串），会被忽略`);
      continue;
    }
    // 合法形态：1/2/3/4 个 token，每个 token 是数字/px 值/语义间距 token（token 里不允许多空格内嵌）
    const tokens = v.trim().split(/\s+/).filter(Boolean);
    const tokenOk = (t) => /^[\d.]+(px)?$/.test(t) || /^[a-zA-Z][a-zA-Z0-9-]*$/.test(t);
    const legal = tokens.length >= 1 && tokens.length <= 4 && tokens.every(tokenOk);
    if (!legal) {
      ctx.warnings.push(`${ctx.tag}: ${key} 值 "${v}" 不是合法 CSS 简写（支持 1~4 个 token，如 20 / '20px' / '20px 40px' / '80px 70 40px'），引擎无法解析会整体忽略 → 请改为合法简写或方向变体（paddingTop 等）`);
    }
  }
}

export function validateSlide(source, { theme = 'business', file = '' } = {}) {
  const errors = [];
  const warnings = [];
  const tag = file || 'slide';

  if (/\bimport\s|\bexport\s|\bmodule\b/.test(source)) {
    errors.push(`${tag}: 出现 import/export/module 模块语句（.slide 是纯组件 DSL，禁止模块语法）`);
  }

  let tree;
  try {
    tree = executeSlide(source);
  } catch (e) {
    errors.push(`${tag}: 编译/执行失败 → ${e.message}`);
    return { errors, warnings };
  }

  try {
    layout(tree, { theme });
  } catch (e) {
    errors.push(`${tag}: 布局失败 → ${e.message}`);
    return { errors, warnings };
  }

  walkValidate(tree, { tag, errors, warnings, theme });

  // 布局级检查：元素重叠检测（2026-09-04 新增）——validate 原只查单元素几何（0尺寸/出画布），
  // 查不出「卡片/内容块挤成一团」（P12 三卡无宽坍缩后 100% 重叠）。保守口径避免误报：
  // ① 只比「会画矩形的 Box/Shape/Image」之间（文字与卡叠加是正常设计，不比）；
  // ② 排除大背景块（宽/高 ≥ 90% 画布，如全页渐变/标题带，与内容天然重叠）；
  // ③ 排除祖先关系（卡与其内部子块）；重叠面积 > 较小者 60% 才算（真挤一起）。
  const rects = collectContentRects(tree).filter((r) => {
    if (r.node.type === 'Text') return false;
    if (r.w >= CANVAS.width * 0.9 || r.h >= CANVAS.height * 0.9) return false; // 大背景块
    return true;
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (isAncestor(a, b) || isAncestor(b, a)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 0 || oy <= 0) continue;
      const inter = ox * oy;
      const small = Math.min(a.w * a.h, b.w * b.h);
      if (small <= 0) continue;
      const ratio = inter / small;
      if (ratio > 0.6) {
        errors.push(`${tag}: 元素重叠 ${a.desc} 与 ${b.desc} 相交面积占较小者 ${Math.round(ratio * 100)}%（区块挤在一起/坐标错位，检查容器宽度与定位）`);
      }
    }
  }

  // 布局级检查 ②：容器坍缩检测（2026-09-04）——flex row 无宽在 center/默认列内坍缩成窄条（P12 三卡
  // 32px 宽挤成一排的根因）。机器特征：有背景的内容 Box 宽窄 + 内部文字 intrinsic 宽显著 > Box 宽
  // （文字放不下 = 坍缩/挤压）；圆形编号徽章（30-44px 单字符）不溢出，不算。
  const collapseBoxes = collectContentRects(tree).filter((r) => r.node.type === 'Box' && r.w < 90 && r.h >= 30);
  for (const r of collapseBoxes) {
    const textW = maxChildTextWidth(r.node);
    if (textW > r.w * 1.5) {
      errors.push(`${tag}: 容器坍缩 Box 宽仅 ${Math.round(r.w)}px 但内部文字需约 ${Math.round(textW)}px（flex 容器无显式宽度在 center/默认列内缩成窄条——给该行/容器显式 width）`);
    }
  }

  return { errors, warnings };
}

// 【换肤友好度】检测「本可用语义 token 却写了 hex」的颜色（2026-09-11）。
// 背景：引擎的主题机制只替换语义 token；写死 hex 的颜色不随主题变（用户换主题时不变）。
// 策略：不阻断（warning），但提醒生成者改用 token。保守排除设计意图色：
//   - 中性色：纯白/纯黑/灰阶（明度极高/极低或饱和度极低）
//   - 语义色：涨跌红绿、警示（正红/正绿）
//   - 半透明 rgba（蒙版/叠层需要具体基色）
// 同一页面同一色值只报一次，避免刷屏。
const COLOR_PROPS = ['color', 'background', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
function isValidHexToken(hex) {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return { valid: false };
  const h6 = m[1];
  const r = parseInt(h6.slice(0, 2), 16), g = parseInt(h6.slice(2, 4), 16), b = parseInt(h6.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 * 255 - max - min) : d / (max + min);
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
    h *= 60;
  }
  // 中性色：灰阶（s<0.14）或极亮/极暗
  if (s < 0.14 || l >= 0.97 || l <= 0.08) return { valid: true };
  // 语义色：正红（涨跌/警示）、正绿
  const isRed = (h <= 12 || h >= 350) && s >= 0.5 && l >= 0.2 && l <= 0.65;
  const isGreen = h >= 105 && h <= 168 && s >= 0.3 && l >= 0.18 && l <= 0.6;
  if (isRed || isGreen) return { valid: true };
  return { valid: false, h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function validateHardcodedColors(node, ctx) {
  const { tag, warnings } = ctx;
  const style = (node.props && node.props.style) || {};
  ctx._hardcodedSeen = ctx._hardcodedSeen || new Set();
  const found = [];
  for (const prop of COLOR_PROPS) {
    const val = style[prop];
    if (typeof val !== 'string') continue;
    // 只查纯 hex（渐变内的 hex 也扫，但用 token 的渐变不告警）
    const hexes = [];
    const direct = /^#([0-9A-Fa-f]{6})$/.exec(val.trim());
    if (direct) hexes.push(val.trim());
    if (/gradient\(/i.test(val)) {
      for (const m of val.matchAll(/#([0-9A-Fa-f]{6})(?![0-9A-Fa-f])/g)) hexes.push('#' + m[1]);
    }
    for (const hex of hexes) {
      const chk = isValidHexToken(hex);
      if (chk.valid) continue; // 中性色/语义色/半透明：设计意图，不告警
      if (ctx._hardcodedSeen.has(hex.toUpperCase())) continue; // 同页同色只报一次
      ctx._hardcodedSeen.add(hex.toUpperCase());
      found.push({ prop, hex, hsl: chk });
    }
  }
  for (const f of found) {
    warnings.push(`${tag}: 颜色 ${f.hex}（${f.prop}）是硬编码色值，不随主题切换——建议改用语义 token（primary/secondary/accent/bg/cardBg/text/muted/textOnDark）以便一键换主题`);
  }
}

function walkValidate(node, ctx, inheritedBg) {
  const { tag, errors, warnings, theme } = ctx;
  if (!node || typeof node !== 'object') return;

  // style 属性白名单校验：不支持属性报 warning
  validateStyleProps(node, ctx);

  // 【换肤友好度】颜色硬编码检测（2026-09-11）：
  // 引擎只对语义 token 做主题替换，写死 hex 的颜色不随主题变——用户后续「换主题」时这些颜色不会变。
  // 这里对「本可用 token 却写了 hex」的颜色报 warning（不阻断），提醒生成者改用语义 token。
  // 保守规则：中性色（纯白/纯黑/灰阶）与语义色（涨跌红绿/警示）是其设计意图，不告警，避免误报。
  validateHardcodedColors(node, ctx);

  // 可读性对比度检查（2026-09-08）：Text/span 显式 color 与所在容器背景对比度 < 阈值 → error
  // 背景解析：本节点背景（Box 的 background / Slide 的 background）覆盖继承；Text 只透传不设背景。
  // 注意：rgba 低 alpha（<0.5）的背景是「半透明装饰叠层」（如 rgba(59,130,246,0.10) 圆环盖在深底上），
  //   实际文字底色仍是其下最深的不透明祖先——这类不覆盖 curBg，否则深底白字会被误判成「浅蓝底 1.0:1」。
  const style = (node.props && node.props.style) || {};
  let curBg = inheritedBg;
  if (style.background && (node.type === 'Box' || node.type === 'Slide')) {
    const alpha = /rgba\([^)]*[,\s]([\d.]+)\)$/.exec(String(style.background));
    if (!alpha || Number(alpha[1]) >= 0.5) {
      const resolved = parseColorAny(style.background, theme);
      if (resolved) curBg = resolved; // 实体背景（不透明或高 alpha）：后续子代文字以它为底
    }
  }
  if (node.type === 'Text') {
    // 可读性对比度（2026-09-08）：只拦「几乎同色真不可读」（对比度 <2.0:1），如浅底 #F5F7FA 字/白底白字/深底黑字；
    // 2.0~4.5 偏弱（浅灰次要用字/accent 强调）→ warning 提示不阻断（兼容历史合法 deck 与刻意弱化设计）。
    const explicit = [];
    if (style.color) explicit.push({ color: style.color, label: '文字' });
    // span 子节点（rich text）：span 的 color 才是局部文字色；无 span 时 Text 自身 color 作用全段
    for (const c of node.children || []) {
      if (typeof c !== 'object' || !c) continue;
      if (c.type === 'span' && c.props?.style?.color) explicit.push({ color: c.props.style.color, label: `span"${String(c.props.children || '').slice(0, 6)}"` });
    }
    const bgRgb = curBg || null;
    for (const { color, label } of explicit) {
      const fg = parseColorAny(color, theme);
      if (!fg || !bgRgb) continue; // 颜色或背景解析不出（渐变背景/无背景）→ 跳过，不误报
      const cr = contrastRatio(fg, bgRgb);
      // error 只拦「几乎同色真不可读」：cr < 2.0（如浅底 #F5F7FA 字 / 白底白字 / 深底黑字 ≈1.0~1.4）——这是低级配色错误；
      // cr 2.0 以上（浅灰次要用字 2.6、accent 强调 2.1 等）属可读性偏弱/设计选择 → warning 提示不阻断（兼容历史合法 deck）。
      if (cr >= 2.0) {
        if (cr < 4.5) {
          warnings.push(`${tag}: ${label}色 ${color} 与所在背景对比度 ${cr.toFixed(1)}:1（正文建议≥4.5:1）——可读性偏弱，若为刻意弱化/强调色可忽略，否则建议加深字色或用语义 token`);
        }
        continue;
      }
      // cr < 2.0：字与祖先背景几乎同色。若字是纯白/纯黑（反色分层设计的典型用字——盖在兄弟 absolute 深/浅色层上，
      // validate 只沿 DOM 祖先链找背景，看不到平级深色块画在底下，如 ending 页白字在 absolute 深色带上）→ 降 warning；
      // 灰阶浅字（#F5F7FA/#E8EDF2 等，真浅底浅字错误典型）仍 error。
      const fgHex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
      const isPureExtreme = fgHex && (parseInt(fgHex.slice(1, 3), 16) >= 248 && parseInt(fgHex.slice(3, 5), 16) >= 248 && parseInt(fgHex.slice(5, 7), 16) >= 248) // 纯白系
        || (fgHex && parseInt(fgHex.slice(1, 3), 16) <= 8 && parseInt(fgHex.slice(3, 5), 16) <= 8 && parseInt(fgHex.slice(5, 7), 16) <= 8); // 纯黑系
      if (isPureExtreme) {
        warnings.push(`${tag}: ${label}色 ${color} 与所在容器背景对比度仅 ${cr.toFixed(1)}:1（容器背景为浅色，若文字实为覆盖在深色分层上请忽略，否则应改深色字）`);
        continue;
      }
      errors.push(`${tag}: ${label}色 ${color} 与所在背景对比度仅 ${cr.toFixed(1)}:1（正文要求≥4.5:1）——文字与背景几乎同色，不可读（浅底必须深字、深底必须浅字）。用语义 token（text/muted/primary）+ 主题背景，或改为对比色 hex`);
    }
  }

  if (node._layout) {
    const { x, y, width, height } = node._layout;
    // 0/负尺寸拦截：有效内容节点不得塌缩成 0×0 或 0 高（会生成非法 OOXML：
    // 圆角矩形的 adj 写成 Infinity，PowerPoint 打开报「内容有问题」）。
    // 精确原则：只拦「会实际输出 shape 的 0 尺寸」——
    //   Box 只在有 background/border/boxShadow 时才输出矩形（renderBox），纯占位空 Box（flex:1 空白）不输出，放行；
    //   Shape type="line"/箭头 的单边 0 是合法规范（横向线），放行；
    //   Slide 根/Text（纯文本靠内容撑高）不检查。
    const style = (node.props && node.props.style) || {};
    const isLineShape = node.type === 'Shape' && ['line', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow'].includes(node.props?.type);
    if (node.type !== 'Text' && node.type !== 'Slide' && !isLineShape) {
      const drawsShape = node.type !== 'Box' || Boolean(style.background || style.border || style.boxShadow);
      if (drawsShape) {
        const w = Math.round(width * 100) / 100;
        const h = Math.round(height * 100) / 100;
        if (w <= 0 && h <= 0) {
          errors.push(`${tag}: 元素 ${node.type} 尺寸为 0×0（空容器/装饰元素无内容无显式宽高导致塌缩，会生成非法 OOXML 致 PowerPoint 报错）→ 请给该元素显式 width/height 或补内容`);
        } else if (w <= 0 || h <= 0) {
          const hint = style.borderRadius
            ? '（带 borderRadius 的 0 尺寸元素会把圆角写成 Infinity → 请给显式宽高）'
            : '（0 尺寸元素会被 PowerPoint 判定异常 → 请给显式宽高或用 padding 撑起）';
          errors.push(`${tag}: 元素 ${node.type} 尺寸为 ${w}×${h}${hint}`);
        }
      }
    }
    // 旋转包围盒：元素旋转后实际占用区域变大（w' = w|cosθ| + h|sinθ|，中心不变）
    let effW = width, effH = height;
    if (typeof style.rotate === 'number' && style.rotate !== 0) {
      const rad = (style.rotate * Math.PI) / 180;
      const ac = Math.abs(Math.cos(rad)), as = Math.abs(Math.sin(rad));
      effW = width * ac + height * as;
      effH = width * as + height * ac;
    }
    if (x + effW > CANVAS.width + 1 || y + effH > CANVAS.height + 1) {
      errors.push(`${tag}: 元素 ${node.type} 溢出画布 (${Math.round(x)},${Math.round(y)}) ${Math.round(effW)}x${Math.round(effH)}（含旋转） 超出 ${CANVAS.width}x${CANVAS.height}`);
    }
  }

  const props = node.props || {};
  switch (node.type) {
    case 'svg': {
      // SVG 元素超出 viewBox 被裁检查（2026-09-04 P6 底部圆 cy440+r26=466 > h456 被裁的教训）
      const vb = String(props.viewBox || '').split(/[\s,]+/).map(Number);
      const vbW = vb.length === 4 && isFinite(vb[2]) ? vb[2] : (typeof props.width === 'number' ? props.width : NaN);
      const vbH = vb.length === 4 && isFinite(vb[3]) ? vb[3] : (typeof props.height === 'number' ? props.height : NaN);
      if (isFinite(vbW) || isFinite(vbH)) {
        const over = [];
        (function scan(sn) {
          for (const c of sn.children || []) {
            if (!c || typeof c !== 'object') continue;
            const p = c.props || {};
            if (c.type === 'circle') {
              const cx = Number(p.cx), cy = Number(p.cy), r = Number(p.r);
              // 满幅装饰圆环（r ≥ 短边 40%，如封面背景大环 cx150 r148）故意贴边，跳过；小圆球（节点/序号）才查贴边防削
              const short = Math.min(isFinite(vbW) ? vbW : Infinity, isFinite(vbH) ? vbH : Infinity);
              const isDeco = isFinite(short) && isFinite(r) && r >= short * 0.4;
              if (!isDeco) {
                if (isFinite(cx) && isFinite(r)) {
                  // 左/右出界或贴边 0（贴 viewBox 0 边界会被光栅化削边，P10 左截教训）
                  if (isFinite(vbW) && (cx - r < 8 || cx + r > vbW - 0.5)) over.push(`圆球(cx${cx},cy${cy},r${r})左缘${cx - r}或右缘${cx + r}贴/出 viewBox 宽(${vbW})——留 ≥8px 边距防削边`);
                }
                if (isFinite(cy) && isFinite(r)) {
                  if (isFinite(vbH) && (cy - r < 8 || cy + r > vbH + 0.5)) over.push(`圆球(cx${cx},cy${cy},r${r})顶${cy - r}或底${cy + r}贴/出 viewBox 高(${vbH})——留 ≥8px 边距防削边`);
                }
              }
            } else if (c.type === 'line') {
              const x1 = Number(p.x1), x2 = Number(p.x2), y2 = Number(p.y2);
              if (isFinite(vbW) && isFinite(x1) && isFinite(x2) && (x1 < 8 || x2 > vbW - 0.5)) over.push(`线(x1=${x1},x2=${x2})贴/出 viewBox 宽`);
              if (isFinite(vbH) && isFinite(y2) && y2 > vbH + 0.5) over.push(`线(y2=${y2})>高${vbH}`);
            } else if (c.type === 'rect') {
              const x = Number(p.x), y = Number(p.y), h = Number(p.height), w = Number(p.width);
              if (isFinite(vbW) && isFinite(x) && isFinite(w) && (x < 8 || x + w > vbW - 0.5)) over.push(`矩形(x${x},w${w})贴/出 viewBox 宽`);
              if (isFinite(vbH) && isFinite(y) && isFinite(h) && y + h > vbH + 0.5) over.push(`矩形(y${y}+h${h})>高${vbH}`);
            }
            if (c.children && c.children.length) scan(c); // g 分组递归
          }
        })(node);
        if (over.length) errors.push(`${tag}: SVG 元素贴/出 viewBox 边界会被裁切：${over.join('；')}（内容四周留 ≥8px 边距，或增大 viewBox）`);
      }
      break;
    }
    case 'Image': {
      const src = props.src;
      if (!src) errors.push(`${tag}: Image 缺少 src`);
      else if (/^(https?:)?\/\//.test(src) || src.startsWith('image://')) errors.push(`${tag}: Image src 用了占位符/在线地址 "${src}"（必须本地相对路径）`);
      break;
    }
    case 'FAIcon': {
      const name = props.name;
      if (!name) errors.push(`${tag}: FAIcon 缺少 name`);
      else if (!hasIcon(name)) errors.push(`${tag}: FAIcon 图标名 "${name}" 不存在（编造图标名）`);
      break;
    }
    case 'Chart': {
      if (!props.data || (Array.isArray(props.data) && props.data.length === 0)) warnings.push(`${tag}: Chart 缺少 data`);
      break;
    }
    case 'Shape': {
      if (!props.shape && !props.type) warnings.push(`${tag}: Shape 未指定形状类型`);
      break;
    }
    case 'QRCode': {
      if (!props.text) errors.push(`${tag}: QRCode 缺少 text`);
      break;
    }
    default: break;
  }

  for (const c of node.children || []) {
    if (typeof c === 'string') continue;
    walkValidate(c, ctx, curBg);
  }
}

// 收集「内容元素」矩形供重叠检测：Text 全部；Box/Shape/Image 需显式布局尺寸且宽高均 >30（滤掉细装饰条）。
// 返回 [{ x, y, w, h, node, desc }]；不含 Slide 根。
function collectContentRects(tree) {
  const out = [];
  function walk(n, ancestors) {
    if (!n || typeof n !== 'object') return;
    const L = n._layout;
    if (L && n.type !== 'Slide') {
      const style = (n.props && n.props.style) || {};
      let include = false;
      if (n.type === 'Text') include = Boolean(n._text);
      else if (n.type === 'Image' || n.type === 'Chart' || n.type === 'QRCode') include = true;
      else if (n.type === 'Box') {
        // 有背景的实心 Box（卡片/色块，会画实心矩形）；纯 border/boxShadow 装饰（圆环/描边，叠加在内容上是设计）不收
        include = Boolean(style.background);
      } else if (n.type === 'Shape') include = true;
      if (include && L.width >= 30 && L.height >= 30) {
        const label = n.type === 'Text' ? `文字"${String(n._text || '').slice(0, 8)}"` : n.type;
        out.push({ x: L.x, y: L.y, w: L.width, h: L.height, node: n, desc: label, ancestors: new Set(ancestors) });
      }
    }
    const next = ancestors.concat(n);
    for (const c of n.children || []) {
      if (typeof c !== 'string') walk(c, next);
    }
  }
  walk(tree, []);
  return out;
}

// 判断 a 是否为 b 的祖先（含自身）——父子嵌套不算重叠（用 rect 上记录的祖先集合）
function isAncestor(a, b) {
  return Boolean(a.ancestors && b.ancestors && b.ancestors.has(a.node));
}

// 找节点子树里 Text 的最大内容宽估算（坍缩检测用：Text 字号×近似字宽×字符数，够区分窄徽章 vs 长文本）
function maxChildTextWidth(n) {
  let max = 0;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Text' && node._text) {
      const style = (node.props && node.props.style) || {};
      const fs = typeof style.fontSize === 'number' ? style.fontSize : (typeof style.fontSize === 'string' ? parseFloat(style.fontSize) || 18 : 18);
      // 全角按 fontSize、半角按 0.55×fontSize 粗估（保守偏小，徽章单字符远小于阈值即可排除）
      let w = 0;
      for (const ch of node._text) w += ch.charCodeAt(0) > 255 ? fs : fs * 0.6;
      if (w > max) max = w;
    }
    for (const c of node.children || []) if (typeof c !== 'string') walk(c);
  }
  walk(n);
  return max;
}

export function validateProject(input, { theme = 'business' } = {}) {
  const files = collectSlideFiles(input);
  const allErrors = [];
  const allWarnings = [];
  const perFile = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf-8');
    const { errors, warnings } = validateSlide(source, { theme, file });
    perFile.push({ file, errors, warnings });
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }
  return { success: allErrors.length === 0, files: files.length, errors: allErrors, warnings: allWarnings, perFile };
}

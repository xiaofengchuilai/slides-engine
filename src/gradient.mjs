// 渐变解析与 OOXML gradFill 生成
// 支持 linear-gradient(角度, 色1 位置%, 色2 位置%, ...) 语法（见 design-principle §2.2）
//
// 【语义色支持】停靠点颜色除 #RRGGBB 外，还接受主题语义 token：
//   linear-gradient(135deg, primary 0%, accent 100%)
//   解析后 stop.color 保留 token 名（如 'primary'），由调用方用 resolveColor(color, theme) 解析。
//   调用方若直接要 XML，请用 buildGradFillXml(grad, theme)（第二参可选，传了才解析 token）。

// 主题语义色 token 白名单（与 theme.mjs 的 colors 键一致 + 常见别名）
// 不在白名单的裸词（如 'to'、'red'）仍按原逻辑跳过，避免把语法词误当颜色。
const SEMANTIC_TOKENS = new Set([
  'primary', 'secondary', 'accent', 'bg', 'text', 'muted', 'cardBg',
  'deep', 'light', 'bright', 'gold', 'goldLight', 'danger', 'success', 'warning',
  'line', 'ink', 'bgSoft',
  // 别名（theme.mjs THEME_ALIASES）
  'textOnDark', 'onDark', 'white', 'label', 'caption', 'subtle', 'surface', 'background',
]);

// 拆停靠点：按【括号深度】切分逗号，不能天真 split(',')。
// 【2026-09-11 修复】原来直接 stopsStr.split(',')，但 rgba(255,255,255,0.16) 内部有 2 个逗号
//   → 被切成 "rgba(255" / "255" / "255" / "0.16) 0%"，其中裸 "255" 被 hex 正则当 3 位 hex
//   → 展开成 #225555（青绿）→ 渐变渲染成错误纯色（实测末页整页变青绿，见 memory）。
function splitStops(str) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of String(str)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

// 解析单个停靠点的颜色 → { color, token?, alpha? }
// alpha（仅 rgba 且 <1）保留，供上层做透明度处理。
function parseStopColor(p) {
  // 【顺序关键】先判语义 token：短 token（deep/bg）的首字符常是 hex 字符（d/e），
  // 若先跑 hex 正则会把 'deep' 误拆成 3 位 hex 'dee' → DDEEEE（实际踩过这个坑）。
  // 故：整个首个词命中白名单 → 直接按 token 处理，不再尝试 hex。
  const wordMatch = p.match(/^([A-Za-z][A-Za-z0-9]*)/);
  if (wordMatch && SEMANTIC_TOKENS.has(wordMatch[1])) {
    return { color: wordMatch[1], token: true };
  }
  // rgb()/rgba()：必须先于 hex 判，否则 "255" 会被当 3 位 hex
  const rgbMatch = p.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,\/]\s*([\d.]+))?\s*\)/i);
  if (rgbMatch) {
    const hex = [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
      .map((n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const out = { color: hex };
    const a = parseFloat(rgbMatch[4]);
    if (Number.isFinite(a) && a < 1) out.alpha = Math.max(0, a);
    return out;
  }
  // hex：【必须带 # 前缀】—— 不带 # 的裸数字（如 rgb 拆分残留的 "255"）不得当颜色。
  // 这是 #225555 那个 bug 的直接来源（原正则 /^#?([0-9A-Fa-f]{6}|...)/ 不要求 #）。
  const hexMatch = p.match(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![0-9A-Fa-f])/);
  if (hexMatch) {
    let color = hexMatch[1];
    if (color.length === 3) color = color.split('').map((c) => c + c).join('');
    return { color: color.toUpperCase() };
  }
  return null;
}

// 解析 linear-gradient(...) 字符串
// 输入: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)"
//       "linear-gradient(135deg, primary 0%, accent 100%)"   ← 语义色
//       "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.3) 100%)"  ← 半透明端点
// 输出: { angle: 135, stops: [{ color: '3B82F6', pos: 0 }, { color: 'primary', token: true, pos: 100 }] }
// 停靠点可带 alpha（rgba 且 <1 时）: [{ color: 'FFFFFF', alpha: 0.16, pos: 0 }]
export function parseLinearGradient(str) {
  const m = String(str).match(/^linear-gradient\(\s*([\d.]+)deg\s*,(.+)\)$/i);
  if (!m) return null;
  const angle = parseFloat(m[1]);
  const stopsStr = m[2];
  const stops = [];
  for (const p of splitStops(stopsStr)) {
    const parsed = parseStopColor(p);
    if (!parsed) continue;
    const posMatch = p.match(/([\d.]+)%/);
    const stop = parsed.token
      ? { color: parsed.color, token: true, pos: null }
      : { color: parsed.color, pos: null };
    if (!parsed.token && parsed.alpha !== undefined) stop.alpha = parsed.alpha;
    stop.pos = posMatch ? parseFloat(posMatch[1]) : null;
    stops.push(stop);
  }
  // 给无位置的停靠点等分填充（0% 到 100%）
  if (stops.some((s) => s.pos === null)) {
    const n = stops.length;
    stops.forEach((s, i) => {
      if (s.pos === null) s.pos = n === 1 ? 0 : (i / (n - 1)) * 100;
    });
  }
  if (stops.length < 2) return null;
  return { angle, stops };
}

// 把 CSS 角度转 OOXML 线性渐变角度
// CSS: 0deg=向上, 顺时针；OOXML: 0=向左, 顺时针（ang 单位 1/60000 度）
// 换算：OOXML ang = (450 - cssDeg) % 360，再 *60000
function cssAngleToOoxml(cssDeg) {
  const ooxmlDeg = (450 - cssDeg) % 360;
  return (ooxmlDeg < 0 ? ooxmlDeg + 360 : ooxmlDeg) * 60000;
}

// 把 stop 颜色转成 OOXML 用的 6 位 hex（去 #）。
// 传了 theme 且 stop 是语义 token → 用 resolveColor 解析；否则原样返回（HEX 大写 / rgb 串）。
// 未传 theme 而遇到 token：返回 null，由调用方决定降级策略。
function stopColorToHex(stop, theme, resolveColor) {
  let c = stop.color;
  if (stop.token) {
    if (!theme || typeof resolveColor !== 'function') return null;
    c = resolveColor(c, theme);
  }
  if (typeof c !== 'string') return null;
  if (c.startsWith('#')) return c.slice(1).toUpperCase();
  // resolveColor 可能返回小写 hex / 带 #；归一化
  const m = c.match(/^#?([0-9A-Fa-f]{6})$/);
  if (m) return m[1].toUpperCase();
  return null;
}

// 生成 <a:gradFill> XML（线性渐变）
// 输入 { angle, stops }；可选 theme + resolveColor（解析语义 token 用）
// 停靠点可带 alpha（0-1）→ 输出 <a:alpha val="..."/>（OOXML alpha 单位 1/1000 %）
// 返回 null 表示无法生成（含未解析的 token）——调用方应降级为纯色。
export function buildGradFillXml(grad, theme, resolveColor) {
  const ang = cssAngleToOoxml(grad.angle);
  const hexes = [];
  for (const s of grad.stops) {
    const hex = stopColorToHex(s, theme, resolveColor);
    if (!hex) return null;
    hexes.push({ hex, pos: s.pos, alpha: s.alpha });
  }
  const gsLst = hexes
    .map((s) => {
      // alpha<1 → 加 <a:alpha>（与 <a:srgbClr> 并列，表达该停靠点的不透明度）
      const alphaXml = (typeof s.alpha === 'number' && s.alpha < 1)
        ? `<a:alpha val="${Math.max(0, Math.round(s.alpha * 100000))}"/>`
        : '';
      return `<a:gs pos="${Math.round(s.pos * 1000)}"><a:srgbClr val="${s.hex}">${alphaXml}</a:srgbClr></a:gs>`;
    })
    .join('');
  return `<a:gradFill rotWithShape="1"><a:gsLst>${gsLst}</a:gsLst><a:lin ang="${ang}" scaled="0"/></a:gradFill>`;
}

// 生成标记名（后处理时按此识别渐变 shape）
// 注意：token 未解析时用 token 名入标记（保证同 token 不同主题下标记稳定，便于后处理替换）
// 【2026-09-11】alpha 编码：rgba 端点的透明度必须随标记传到 postprocess，否则半透明渐变
//   会被当成不透明颜色渲染（实测：deep 底上的 rgba 白/黑覆盖层变成灰阶，把蓝底盖死）。
//   格式：色值用 '_' 连接；若某停靠点有 alpha<1，紧跟 '@' + 百分整数（如 FFFFFF@84）。
export function gradientTag(angle, stops) {
  const colors = stops.map((s) => {
    const base = s.token ? String(s.color).toUpperCase() : String(s.color);
    return (s.alpha !== undefined && s.alpha < 1) ? base + '@' + Math.round(s.alpha * 100) : base;
  }).join('_');
  return `GRAD_${Math.round(angle)}_${colors}`;
}

// 从标记里解析出的色串 → 停靠点（含 alpha）。供 postprocess 复用。
// 输入形如 "FFFFFF@84_000000@70" 或 "431407_F59E0B"
// 返回 [{ color, alpha?, pos }]；pos 按顺序等分（与标记链路一致，标记不带位置）。
export function stopsFromTagColors(colorsStr) {
  const parts = String(colorsStr).split('_').filter(Boolean);
  return parts.map((p, i) => {
    const [color, aStr] = p.split('@');
    const stop = { color: color.toUpperCase(), pos: parts.length === 1 ? 0 : (i / (parts.length - 1)) * 100 };
    const a = parseFloat(aStr);
    if (Number.isFinite(a) && a < 100) stop.alpha = Math.max(0, a / 100);
    return stop;
  });
}

// 解析渐变的首个可见色（供 pptxgenjs slide.background 这类「只能纯色」的场景降级用）
// 传 theme 时解析 token；解析失败返回 null。
export function firstStopColor(grad, theme, resolveColor) {
  for (const s of grad.stops) {
    const hex = stopColorToHex(s, theme, resolveColor);
    if (hex) return hex;
  }
  return null;
}

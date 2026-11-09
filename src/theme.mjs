// 主题系统：可切换的设计 token（色板/字号/间距）
// 参考 design-principle.md 的色彩体系，提供多套主题
// 语义 token：组件 style 里可用 'primary'/'secondary'/'accent'/'bg'/'text' 引用主题色
// 字体：typography.body 用标记 'sans'（黑体）/'serif'（宋体），getTheme 时替换为探测到的系统真实字体

import { sansFont, serifFont } from './fonts.mjs';

export const themes = {
  // 商务蓝白（默认）
  business: {
    name: '商务蓝白',
    colors: {
      primary: '#1E3A8A',   // 主色（深蓝）
      secondary: '#3B82F6', // 辅色（亮蓝）
      accent: '#F59E0B',    // 强调色（琥珀）
      bg: '#FFFFFF',        // 背景
      text: '#0F172A',      // 文本
      muted: '#64748B',     // 次要文本
      danger: '#DC2626',    // 警示红（关键词/风险）
      success: '#16A34A',   // 绿色（数据涨跌）
      warning: '#EA580C',   // 橙（中等风险）
      line: '#E2E8F0',      // 线框（描边/表格线）
      bgSoft: '#F8FAFC',    // 次级背景
      cardBg: '#F5F7FA',    // 卡片底（极浅蓝灰，卡片与白底分层）
      // ── 跨主题通用 token（2026-09-11 统一契约：任何主题都能换到任何主题）──
      deep: '#132C5F',      // 深蓝（深底/章节/重点；比 primary 更深一档）
      light: '#DBEAFE',     // 浅蓝（卡片底/表头浅底）
      ink: '#334155',       // 深灰（Source/脚注）
      bright: '#60A5FA',    // 高光蓝（渐变中段/强调）
      gold: '#FBBF24',      // 金（装饰/重点）
      goldLight: '#FDE68A', // 浅金（高光/金字底）
    },
    typography: {
      body: 'sans',        // 黑体（商务现代 → 思源黑体/微软雅黑）
      scale: [48, 32, 24, 18, 14], // 字号阶梯
    },
  },
  // 科技金融（深色背景）
  tech: {
    name: '科技金融',
    colors: {
      primary: '#3B82F6',
      secondary: '#06B6D4',
      accent: '#F97316',
      bg: '#0F172A',
      text: '#F7F4EC',
      muted: '#94A3B8',
      danger: '#EF4444',    // 警示红（深底高亮）
      success: '#22C55E',   // 绿色（数据涨跌，深底亮绿）
      warning: '#FB923C',   // 橙（深底高亮）
      line: '#334155',      // 线框（深底线略亮）
      bgSoft: '#1E293B',    // 次级背景（比 bg 亮一档）
      cardBg: '#1E293B',    // 卡片底（比 bg 亮一档的深色）
      // ── 跨主题通用 token（2026-09-11 统一契约）──
      deep: '#020617',      // 近黑深蓝（深底/章节）
      light: '#1E40AF',     // 深色主题的「浅色」= 亮一档的蓝（卡片底）
      ink: '#CBD5E1',       // 深底上的脚注灰（亮灰）
      bright: '#60A5FA',    // 高光蓝
      gold: '#FBBF24',      // 金
      goldLight: '#FDE68A', // 浅金
    },
    typography: {
      body: 'sans',
      scale: [48, 32, 24, 18, 14],
    },
  },
  // 人文文化（宣纸米 + 松烟墨）
  culture: {
    name: '人文文化',
    colors: {
      primary: '#1A1A1A',
      secondary: '#A8351A',
      accent: '#A8351A',
      bg: '#F7F4EC',
      text: '#3F4A55',
      muted: '#8A8A8A',
      danger: '#B91C1C',    // 警示红（米底沉稳红）
      success: '#15803D',   // 绿色（数据涨跌）
      warning: '#C2410C',   // 橙（米底沉稳橙）
      line: '#E2DCD0',      // 线框（宣纸米上线色略深）
      bgSoft: '#F0EBE0',    // 次级背景
      cardBg: '#F3EFE6',    // 卡片底（比宣纸米略深一档）
      // ── 跨主题通用 token（2026-09-11 统一契约）──
      deep: '#1A1A1A',      // 墨黑（深底/章节/重点）—— 修复：换肤到 culture 时 deep 不再兑底成灰
      light: '#EFE9DC',     // 浅米（卡片底/表头浅底）
      ink: '#5A6570',       // 深灰（Source/脚注）
      bright: '#C4502E',    // 高光砖红（渐变中段/强调）
      gold: '#B8860B',      // 暗金（装饰/重点）
      goldLight: '#E8D5A3', // 浅金（高光/金字底）
    },
    typography: {
      body: 'serif',       // 宋体（人文质感 → 思源宋体/宋体）
      scale: [48, 32, 24, 18, 14],
    },
  },

  // ── 以下三套风格预设 ──

  // 学术风：蓝白浅灰，可信、证据驱动、克制
  academic: {
    name: '学术风',
    colors: {
      primary: '#1E4FA8',    // 主蓝（顶条/编号/强调）
      secondary: '#3D7BD9',  // 中蓝（链接/描边/图表第二色）
      accent: '#FFC107',     // 数据黄（图表第二序列/核心金句，单页≤3%）
      bg: '#FFFFFF',         // 主背景
      text: '#1A2230',       // 文本主色
      muted: '#8B97A8',      // 辅助文本
      // 风格特有 token（.slide 里可直接用语义色引用）
      deep: '#0E3F8C',       // 藏蓝（深底/章节/重点）
      light: '#E8EFF8',      // 浅蓝（卡片底/表头浅底）
      danger: '#D9534F',     // 警示红（关键词/异常/风险，单页≤3%）
      line: '#D6DCE5',       // 线框（描边/表格线）
      bgSoft: '#F7F9FC',     // 次级背景
      success: '#2E7D32',    // 绿色（数据涨跌/正向结论）
      cardBg: '#F5F8FC',     // 卡片底（极浅蓝灰）
      // ── 跨主题通用 token（2026-09-11 统一契约）──
      warning: '#E67E22',    // 橙（中等风险）
      ink: '#44546A',        // 深灰（Source/脚注）
      bright: '#5B9BD5',     // 高光蓝（渐变中段/强调）
      gold: '#FFC000',       // 金（装饰/重点）
      goldLight: '#FFE79B',  // 浅金（高光/金字底）
    },
    typography: {
      body: 'sans',         // 学术 → 思源黑为主
      scale: [48, 32, 24, 18, 14],
    },
  },

  // 商务咨询风：Navy 权威、数据密集、结构化
  consulting: {
    name: '商务咨询',
    colors: {
      primary: '#061F32',    // Navy 主色（章节底/主框架/重点色块）
      secondary: '#001965',  // 皇家蓝（图表第二蓝/层级色）
      accent: '#08A6F6',     // Cyan（关键点缀/客户/重点标记，单页≤5%）
      bg: '#FFFFFF',         // 内页主底
      text: '#1A1A1A',       // 文本
      muted: '#808080',      // 中性灰（脚注/边框）
      // 风格特有 token
      light: '#99BDED',      // 浅蓝（图表第三档）
      danger: '#5A0E13',     // 暗红（涨色/警示，仅数据或风险）
      success: '#177B57',    // 绿色（跌色，仅数据涨跌）
      warning: '#F47B39',    // 橙色（中等风险，少量）
      line: '#E7E6E6',       // 表底/边框
      ink: '#44546A',        // 深灰（Source/脚注）
      bgSoft: '#FAFAFA',     // 次级背景（极浅中性灰）
      cardBg: '#F6F7F8',     // 卡片底（极浅中性灰，对齐 gray-50）
      // ── 跨主题通用 token（2026-09-11 统一契约）──
      deep: '#02121F',       // 深 Navy（深底/章节；比 primary 更暗）
      bright: '#4FC3F7',     // 高光 Cyan（渐变中段/强调）
      gold: '#D4AF37',       // 金（装饰/重点）
      goldLight: '#F0E0A8',  // 浅金（高光/金字底）
    },
    typography: {
      body: 'sans',         // 咨询 → Arial/黑体（正文黑体）
      scale: [48, 32, 24, 18, 14],
    },
  },

  // 红金政务风：庄重、红金热烈、中文优先
  redgold: {
    name: '红金政务',
    colors: {
      primary: '#E63F26',    // 主红（封面/目录/美术层主底）
      secondary: '#C42819',  // 深朱红（内页装饰条/标题强调/卡头）
      accent: '#E19825',     // 主金（飘带/装饰/重点）
      bg: '#FFFFFF',         // 内页主背景
      text: '#171616',       // 正文主字
      muted: '#9CA3AF',      // 中性灰（分隔线/脚注）
      danger: '#B91C1C',     // 警示红（红金风下更深的红）
      // 风格特有 token
      deep: '#A81810',       // 暗红（深层红色装饰，少量）
      bright: '#EE5530',     // 高光红（渐变中段/强调）
      goldLight: '#FFE79B',  // 浅金（高光/金字）
      gold: '#FFC000',       // 标准金（粒子/金字）
      success: '#16A34A',    // 绿（仅数据跌）
      warning: '#F59E0B',    // 橙（中等风险）
      line: '#E5E7EB',       // 分隔线
      bgSoft: '#FAF7F2',     // 次级背景（比主底略深的米白）
      cardBg: '#FBF7F0',     // 卡片底（极浅米白）
      // ── 跨主题通用 token（2026-09-11 统一契约）──
      light: '#F7DFC8',      // 浅金底（卡片底/表头浅底）
      ink: '#5C3A2E',        // 深褐灰（Source/脚注）
    },
    typography: {
      body: 'sans',         // 政务正文黑体（正文禁宋体大段）
      scale: [48, 32, 24, 18, 14],
    },
  },
};

export const DEFAULT_THEME = 'business';

// 字号语义层（typeScale）：让模板用语义名引用字号，Agent 选层级、改不了绝对值。
// 字号梯度规律（标题 > 数据 > 卡片标题 > 正文 > 标签），
// 绝对值对齐 consulting 规范（KPI 大数、正文 ≥22px 等）。
export const TYPE_SCALE = {
  hero: 96,    // 封面/章节巨字
  kpi: 56,     // KPI 大数（数据锚点，视觉主角）
  title: 32,   // 页面标题（Action Title）
  card: 22,    // 卡片标题/次级标题
  body: 16,    // 正文说明
  label: 13,   // 标签/脚注/来源
};

// 解析语义字号：数字 → 原样；语义名（hero/kpi/title/card/body/label）→ typeScale 查表
// 返回 null 表示未设置。
export function resolveFontSize(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (TYPE_SCALE[value] !== undefined) return TYPE_SCALE[value];
  return value; // 未知字符串原样返回（不拦截）
}

// ── 排版参数 token（spacing / radius）──
// 间距/内边距/圆角走语义层（沿用 Tailwind 刻度）：
// Agent 只能选「这是条目间距还是卡片间距」，写不了 22px 还是 24px。
export const SPACING = {
  xs: 8,    // 紧凑：图标与文字、极密
  sm: 12,   // 较紧：条目内
  md: 16,   // 中：数据与标签、卡片内区块
  lg: 20,   // 松：段落间、卡片列距
  xl: 24,   // 更松：卡片间
  xxl: 32,  // 分组：大区块、行间
};

export const RADIUS = {
  sm: 8,    // 标准卡片圆角
  md: 12,   // 大卡
  lg: 16,   // 特大卡
};

// 解析语义间距：数字 → 原样；语义名（xs/sm/md/lg/xl/xxl）→ SPACING 查表；'10px' 等字符串原样返回
// （由 parseBoxValue 的 parseFloat 再处理 px 后缀）
export function resolveSpacing(value) {
  if (value == null) return value;
  if (typeof value === 'number') return value;
  if (SPACING[value] !== undefined) return SPACING[value];
  return value;
}

// 解析语义圆角：数字 → 原样；语义名（sm/md/lg）→ RADIUS 查表
export function resolveRadius(value) {
  if (value == null) return value;
  if (typeof value === 'number') return value;
  if (RADIUS[value] !== undefined) return RADIUS[value];
  return value;
}

export const THEME_ALIASES = {
  // 通用别名：Agent 常用的「深底反白文字」写法，各主题下统一指向该主题的 high-contrast 亮色
  textOnDark: 'onDark',
  white: 'onDark',
  ink: 'text',
  label: 'muted',
  caption: 'muted',
  subtle: 'muted',
  surface: 'cardBg',
  background: 'bg',
};

// 解析语义色：'primary' → 主题色，'#RRGGBB' → 原样，别名（textOnDark）→ 映射后再查，其他 → 原样
// 【重要】未命中的裸名会原样返回——下游 toHex() 会把它当字符串处理出乱色（曾出现 EEDDAA 这种）。
// 所以这里对「像是语义名但未定义」的值也做兑底：返回主题文本色（安全色），并告警。
export function resolveColor(value, theme) {
  if (!value) return null;
  const t = theme || themes[DEFAULT_THEME];
  if (typeof value !== 'string') return value;
  if (value.startsWith('#') || value.startsWith('rgb')) return value;
  // 【2026-09-11 修复】裸 hex（不带 #，6 位）必须原样返回：
  //   渐变/函数内把 rgba(255,255,255,0.16) 解析成 "FFFFFF"（无 #）后，
  //   旧逻辑会把它当「像 token 的裸名」→ 兑底成 text 色 → 白色变深灰（实际踩到：
  //   末页渐变覆盖层变 #1A2230，整页配色错误）。
  //   安全性：现有主题 token 名无一个是纯 6 位 hex 字符集（含 n/r/u/t/x/g/S 等非 hex 字母），不会误伤。
  if (/^[0-9A-Fa-f]{6}$/.test(value)) return value;
  if (t.colors[value]) return t.colors[value];
  // 别名：textOnDark → onDark → 实际色值
  const alias = THEME_ALIASES[value];
  if (alias && t.colors[alias]) return t.colors[alias];
  // 未知裸名：小写字母组成的词才可能是语义名（排除 'to bottom' 这类语法词由调用方处理）
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
    const fallback = t.colors.text || '#000000';
    console.warn(`⚠ [theme] 未知语义色 token "${value}"（主题 ${t.name || ''}）→ 兑底用 text 色 ${fallback}`);
    return fallback;
  }
  return value;
}

// 取主题（动态注入探测到的系统真实字体）
export function getTheme(name) {
  const base = themes[name] || themes[DEFAULT_THEME];
  // 把 typography.body 的标记 'sans'/'serif' 换成探测到的真实字体名
  const fontName = base.typography.body === 'serif' ? serifFont() : sansFont();
  return {
    ...base,
    colors: { ...base.colors, ...aliasColors(base.colors) },
    typography: {
      ...base.typography,
      body: fontName,
      display: fontName, // display 与 body 一致（引擎目前只用 body，display 保留兼容）
    },
  };
}

// 为每个主题算出别名色（onDark 等）——避免 Agent 写了未定义的 token 时被当普通字符串用（曾出现 EEDDAA 这种乱色）
function aliasColors(colors) {
  // onDark：深底上的高对比亮色。深底主题用近白，浅底主题也用近白（用于深色块内文字）
  const onDark = colors.onDark || '#FFFFFF';
  return { onDark };
}

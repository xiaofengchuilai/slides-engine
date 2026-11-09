// 字体探测模块：跨平台探测系统真实存在的中文字体，统一「测量」与「渲染」用同一字体
// 核心目标：canvas 测量用的字体 == pptx 输出的 fontFace，避免「测量字体 ≠ 渲染字体」导致的
// 溢出/过早换行/对齐偏差（实测雅黑 vs 思源宽度差 0~2.8%）。
//
// 关键约束（引擎特有，不使用字体回退链，必须是单个真实字体名）：
//   引擎直接拼 OOXML，fontFace 必须是「单个真实存在的字体名」；且 canvas 测 bold 需要
//   「有独立 bold 字体文件」的字体，否则加粗文本测量会 fallback 成 regular、宽度偏小。
//   可变字体（VF，如 Noto Sans SC）没有独立 bold 文件，bold 测量失效——因此探测优先级里
//   「有独立 bold 文件的字体」排在前面（微软雅黑 > 思源/Noto）。
//
// 优先级（按「bold 可用性 + 视觉气质」综合排序）：
//   黑体类：微软雅黑(有bold) → 苹方 → 思源黑体/Noto Sans SC → sans-serif
//   宋体类：思源宋体/Noto Serif SC → 宋体 SimSun → 微软雅黑 → sans-serif

import { createCanvas, registerFont } from 'canvas';
import fs from 'node:fs';

// 各平台字体文件候选（含 regular/bold 两个文件，bold 缺失则西文加粗测量不准）
// 路径用固定系统路径探测，找不到就跳过
// 关键（实测）：加粗是否变宽只影响「西文/数字/字母」，中文等宽方块字加粗宽度不变。
// 因此 bold 文件的优先级主要服务于「英文标题/章节编号/KPI数字」等西文加粗测量。
function fontCandidates() {
  const win = process.platform === 'win32';
  const mac = process.platform === 'darwin';
  const candidates = [];

  // Windows 字体目录
  if (win) {
    candidates.push(
      // 黑体：微软雅黑（有独立 bold，优先）
      { kind: 'sans', family: 'Microsoft YaHei', regular: 'C:/Windows/Fonts/msyh.ttc', bold: 'C:/Windows/Fonts/msyhbd.ttc' },
      // 黑体降级：思源黑体 Noto Sans SC（VF，无独立 bold）
      { kind: 'sans', family: 'Noto Sans SC', regular: 'C:/Windows/Fonts/NotoSansSC-VF.ttf', bold: null },
      { kind: 'sans', family: 'SimHei', regular: 'C:/Windows/Fonts/simhei.ttf', bold: null },
      // 宋体：SimSun（配 simsunb 做西文加粗）
      { kind: 'serif', family: 'SimSun', regular: 'C:/Windows/Fonts/simsun.ttc', bold: 'C:/Windows/Fonts/simsunb.ttf' },
      // 宋体降级：思源宋体 Noto Serif SC（VF）
      { kind: 'serif', family: 'Noto Serif SC', regular: 'C:/Windows/Fonts/NotoSerifSC-VF.ttf', bold: null },
      { kind: 'serif', family: 'STSong', regular: 'C:/Windows/Fonts/STSONG.TTF', bold: null },
    );
  }

  // macOS 字体目录
  if (mac) {
    const macBase = '/System/Library/Fonts';
    const macSupp = '/System/Library/Fonts/Supplemental';
    candidates.push(
      // 黑体：苹方
      { kind: 'sans', family: 'PingFang SC', regular: `${macBase}/PingFang.ttc`, bold: null },
      { kind: 'sans', family: 'Hiragino Sans GB', regular: `${macBase}/Hiragino Sans GB.ttc`, bold: null },
      // 宋体：宋体-简 / 华文宋体
      { kind: 'serif', family: 'Songti SC', regular: `${macSupp}/Songti.ttc`, bold: null },
      { kind: 'serif', family: 'STSong', regular: `${macBase}/STSong.ttf`, bold: null },
    );
  }

  // Linux 字体目录（常见路径）
  if (!win && !mac) {
    const notoBase = [
      '/usr/share/fonts/opentype/noto',
      '/usr/share/fonts/truetype/noto',
      '/usr/share/fonts/noto-cjk',
      '/usr/local/share/fonts/noto',
    ];
    for (const base of notoBase) {
      // 黑体：Noto Sans CJK SC（regular + bold 独立文件）
      const sansReg = `${base}/NotoSansCJK-Regular.ttc`;
      const sansBold = `${base}/NotoSansCJK-Bold.ttc`;
      if (fs.existsSync(sansReg)) {
        candidates.push({ kind: 'sans', family: 'Noto Sans CJK SC', regular: sansReg, bold: fs.existsSync(sansBold) ? sansBold : null });
        break;
      }
    }
    for (const base of notoBase) {
      // 宋体：Noto Serif CJK SC
      const serifReg = `${base}/NotoSerifCJK-Regular.ttc`;
      const serifBold = `${base}/NotoSerifCJK-Bold.ttc`;
      if (fs.existsSync(serifReg)) {
        candidates.push({ kind: 'serif', family: 'Noto Serif CJK SC', regular: serifReg, bold: fs.existsSync(serifBold) ? serifBold : null });
        break;
      }
    }
  }

  return candidates;
}

// 已注册的字体族（family → { hasBold }）
const _registered = new Map();

// 探测并注册所有可用字体；返回 { sansFamily, serifFamily, monoFamily }
// sansFamily/黑体：微软雅黑优先；serifFamily/宋体：Noto Serif/SimSun
let _resolved = null;

export function resolveFonts() {
  if (_resolved) return _resolved;

  const candidates = fontCandidates();
  const found = { sans: null, serif: null };

  for (const c of candidates) {
    if (!c.regular || !fs.existsSync(c.regular)) continue;
    try {
      registerFont(c.regular, { family: c.family });
      if (c.bold && fs.existsSync(c.bold)) {
        registerFont(c.bold, { family: c.family, weight: 'bold' });
        _registered.set(c.family, { hasBold: true });
      } else {
        _registered.set(c.family, { hasBold: false });
      }
      // 按 kind 标记归入 sans/serif（第一个命中者胜出，即候选数组的优先级）
      if (c.kind === 'sans' && !found.sans) found.sans = c.family;
      if (c.kind === 'serif' && !found.serif) found.serif = c.family;
    } catch (e) {
      // 注册失败跳过（字体文件损坏/格式不支持）
    }
  }

  // 兜底：没有任何中文字体时，sans 用 sans-serif（canvas 测量不准但不崩），serif 用 sans
  if (!found.sans) found.sans = 'sans-serif';
  if (!found.serif) found.serif = found.sans;

  _resolved = found;
  return found;
}

// 取黑体字体名（标题/正文通用）
export function sansFont() {
  return resolveFonts().sans;
}

// 取宋体/衬线字体名（culture 主题正文）
export function serifFont() {
  return resolveFonts().serif;
}

// ── 手绘字体（hand-drawn 风格）──
// Comic Sans MS：Windows/macOS 自带，Linux 装 ttf-mscorefonts-installer 后可用。
// 跨平台策略：各平台探测 Comic Sans MS 文件；找不到则注册失败，返回 null（调用方降级 sans）。
// 注意：Comic Sans MS 不覆盖中文，中文会自动 fallback 到系统中文字体（引擎 fontFace 单字体名天然支持）。
function handFontCandidates() {
  const win = process.platform === 'win32';
  const mac = process.platform === 'darwin';
  const candidates = [];
  if (win) {
    candidates.push({ family: 'Comic Sans MS', regular: 'C:/Windows/Fonts/comic.ttf', bold: 'C:/Windows/Fonts/comicbd.ttf' });
  }
  if (mac) {
    const supp = '/System/Library/Fonts/Supplemental';
    candidates.push({ family: 'Comic Sans MS', regular: `${supp}/Comic Sans MS.ttf`, bold: `${supp}/Comic Sans MS Bold.ttf` });
  }
  if (!win && !mac) {
    const linuxBase = '/usr/share/fonts/truetype/msttcorefonts';
    candidates.push({ family: 'Comic Sans MS', regular: `${linuxBase}/Comic_Sans_MS.ttf`, bold: `${linuxBase}/Comic_Sans_MS_Bold.ttf` });
  }
  return candidates;
}

let _handFont = null;
export function handFont() {
  if (_handFont) return _handFont;
  _handFont = null;
  for (const c of handFontCandidates()) {
    if (!c.regular || !fs.existsSync(c.regular)) continue;
    try {
      registerFont(c.regular, { family: c.family });
      if (c.bold && fs.existsSync(c.bold)) {
        registerFont(c.bold, { family: c.family, weight: 'bold' });
      }
      _handFont = c.family;
      break;
    } catch (e) { /* 注册失败跳过 */ }
  }
  return _handFont;
}

// 是否注册了 bold（用于判断加粗测量是否可靠）
export function hasBold(family) {
  return !!_registered.get(family)?.hasBold;
}

// 文本测量模块：node-canvas 真实测量
// 宽度：measureText().width（真实）
// 高度：Math.ceil(fontSize × 1.2)（1.2 为默认行距系数，实测反推）

import { createCanvas } from 'canvas';
import { resolveFonts } from './fonts.mjs';

// 单例 canvas context，避免重复创建
let _ctx = null;
function getCtx() {
  if (!_ctx) {
    // 首次测量前，确保系统字体已探测并注册（fonts.mjs 内部有缓存，幂等）
    resolveFonts();
    const canvas = createCanvas(100, 100);
    _ctx = canvas.getContext('2d');
  }
  return _ctx;
}

function toFontString(fontSize, fontFamily = 'sans-serif', fontWeight = '') {
  // node-canvas 只认 CSS 标准字重：normal / bold / 100-900 数值。
  // 非标字符串（extralight/light/medium/thin 等）会让 canvas 整句 font 解析失败
  // → fallback 到默认 10px 字体 → 文本宽度测量系统性偏小（实测 48px 数字量成 12.7px）。
  // 引擎支持的字重语义：thin/extralight/light → 渲染时 PPT 用细体，但宽度测量与 normal 几乎一致
  //（细体只是笔画细，字宽不变），因此测量一律映射到支持的 normal/bold。
  let w = fontWeight;
  if (typeof w === 'string') {
    if (/^(thin|extralight|light|normal|regular|medium)$/.test(w)) w = 'normal';
    else if (w === 'bold' || w === 'bolder') w = 'bold';
    else if (/^\d+$/.test(w)) {
      const n = parseInt(w, 10);
      w = n >= 600 ? 'bold' : 'normal';
    }
    else w = 'normal';
  }
  const fam = fontFamily;
  return `${w}${w ? ' ' : ''}${fontSize}px ${fam}`;
}

// 是否全角字符（宽 == fontSize，与 bold 无关 —— PPT 假加粗不改变全角字宽）。
// 背景：SimSun 的 bold 注册字体 simsunb.ttf（实为 NSimSun）里，部分全角符号（· U+00B7、
// — U+2014、● U+25CF 等）字形度量异常（9~21px，正常应 34px），导致整句 bold 测量偏窄、
// 引擎误判"放得下"不折行，而 PowerPoint 真渲染时全角按 fontSize 排 → 溢出。
// 治本：全角字符（CJK 表意 + 全角标点 + 中文语境白名单符号）宽度确定性取 fontSize，
// 不经 canvas 字体文件测量，彻底免疫字体文件怪癖；半角/西文/数字仍走 canvas 实测。
export function isFullWidthChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  if (cp >= 0x4e00 && cp <= 0x9fff) return true; // CJK 统一表意
  if (cp >= 0x3400 && cp <= 0x4dbf) return true; // CJK 扩展 A
  if (cp >= 0x20000 && cp <= 0x2a6df) return true; // CJK 扩展 B（补充平面）
  if (cp >= 0x3000 && cp <= 0x303f) return true; // CJK 标点（。、〈〉《》「」等）
  if (cp >= 0xff00 && cp <= 0xffef) return true; // 全角形式（，．：；！？（）等）
  if (cp >= 0xf900 && cp <= 0xfaff) return true; // CJK 兼容表意
  if (cp >= 0x2f800 && cp <= 0x2fa1f) return true; // CJK 兼容补充
  // 中文语境常用但落在其它区间的全角符号白名单（SimSun normal 实测均 = fontSize）
  // 注意：U+2022 •（项目符号）SimSun 按半角 17px 排，不列入
  const extra = new Set([
    0xb7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x25cf, 0x3007, 0x00d7, 0x00f7,
  ]);
  return extra.has(cp);
}

// 单段半角文本 canvas 实测宽（内部：把连续非全角字符聚成段一次性测，减少 canvas 调用）
function measureRun(ctx, run, fontSize, fontFamily, fontWeight) {
  ctx.font = toFontString(fontSize, fontFamily, fontWeight);
  return ctx.measureText(run).width;
}

// 测量单行文本宽度（像素）
// - 全角字符确定性 = fontSize（bold 不变）
// - 半角/西文/数字走 canvas 真测（bold 用注册粗体）
// - letterSpacing（px）：每个字符间距，总宽补偿 (可视字符数-1) × spacing
export function measureWidth(text, { fontSize = 18, fontFamily = 'sans-serif', fontWeight = '', letterSpacing = 0 } = {}) {
  if (!text) return 0;
  const ls = Number(letterSpacing) || 0;
  const ctx = getCtx();
  let w = 0;
  let run = ''; // 累积半角段
  let visibleChars = 0;
  const flush = () => {
    if (run) {
      w += measureRun(ctx, run, fontSize, fontFamily, fontWeight);
      run = '';
    }
  };
  for (const ch of text) {
    if (ch === '\n') { flush(); continue; } // 换行符不计宽（多行场景由调用方按行处理）
    visibleChars++;
    if (isFullWidthChar(ch)) {
      flush();
      w += fontSize; // 全角：确定性宽 = fontSize
    } else {
      run += ch;
    }
  }
  flush();
  if (ls > 0 && visibleChars > 1) w += ls * (visibleChars - 1);
  return w;
}

// 行高：Math.ceil(fontSize × lineHeight × 1.2)
// 实测反推：
//   fontSize=32, lineHeight=默认 → ceil(32×1.0×1.2)=39px
//   fontSize=32, lineHeight=1.2   → ceil(32×1.2×1.2)=47px
//   fontSize=32, lineHeight=1.5   → ceil(32×1.5×1.2)=58px
// 其中 lineHeight 默认 1.0，1.2 是 PPT 单倍行距系数
export function measureLineHeight(fontSize, { lineHeight = 1.0 } = {}) {
  return Math.ceil(fontSize * lineHeight * 1.2);
}

// 测量文本块的固有尺寸（宽度 = 文本实际宽度，高度 = 真实行高 × 行数）
// 注意：这是「固有尺寸」，用于 Yoga measure func。
// 是否换行取决于 Yoga 传入的可用宽度（在布局层处理），这里只测单行固有尺寸。
export function measureIntrinsicSize(text, {
  fontSize = 18,
  fontFamily = 'sans-serif',
  fontWeight = '',
} = {}) {
  const width = measureWidth(text, { fontSize, fontFamily, fontWeight });
  const height = text ? measureLineHeight(fontSize, { fontFamily, fontWeight }) : 0;
  return { width, height };
}

// 按可用宽度折行：把文本切成多行，每行宽度 ≤ maxWidth
// 全角字符逐字可断行；半角连续串（英文单词/数字）为不可断 token；空白为可断边界
// 宽度判定与 measureWidth 同口径（全角确定性宽 + letterSpacing 补偿）
// 返回字符串数组
export function wrapText(text, maxWidth, { fontSize = 18, fontFamily = 'sans-serif', fontWeight = '', letterSpacing = 0 } = {}) {
  if (!text || maxWidth <= 0) return text ? [text] : [];
  if (!text) return [];
  const ls = Number(letterSpacing) || 0;
  const ctx = getCtx();

  // 折行单位切分：全角字符/空白/半角连续串
  function tokenize(para) {
    const tokens = [];
    let asciiRun = '';
    const flushAscii = () => {
      if (asciiRun) { tokens.push(asciiRun); asciiRun = ''; }
    };
    for (const ch of para) {
      if (isFullWidthChar(ch)) { flushAscii(); tokens.push(ch); }
      else if (/\s/.test(ch)) { flushAscii(); tokens.push(ch); }
      else asciiRun += ch;
    }
    flushAscii();
    return tokens;
  }

  // 按当前累计字符计算含字距的宽度（用与 measureWidth 一致的逐字符口径）
  function lineWidth(chars) {
    if (!chars.length) return 0;
    let w = 0;
    let run = '';
    const flush = () => {
      if (run) {
        ctx.font = toFontString(fontSize, fontFamily, fontWeight);
        w += ctx.measureText(run).width;
        run = '';
      }
    };
    for (const ch of chars) {
      if (isFullWidthChar(ch)) { flush(); w += fontSize; }
      else run += ch;
    }
    flush();
    if (ls > 0 && chars.length > 1) w += ls * (chars.length - 1);
    return w;
  }

  const lines = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para === '') { lines.push(''); continue; }
    const tokens = tokenize(para);
    let line = '';
    let lineChars = [];
    for (const token of tokens) {
      // 空白 token 若在行首则吞掉（trimStart 语义），否则保留一个空格
      const candidate = (line === '' && /^\s+$/.test(token)) ? line : line + token;
      const candChars = [...lineChars];
      if (!(line === '' && /^\s+$/.test(token))) {
        for (const ch of token) candChars.push(ch);
      }
      const fits = lineWidth(candChars) <= maxWidth;
      if (fits || line === '') {
        if (!(line === '' && /^\s+$/.test(token))) {
          line = candidate;
          lineChars = candChars;
        }
      } else {
        if (line.trim()) lines.push(line.trim());
        const t = token.trimStart();
        line = t;
        lineChars = t === '' ? [] : [...t];
      }
    }
    if (line) lines.push(line.trim());
  }
  return lines.length ? lines : [text];
}

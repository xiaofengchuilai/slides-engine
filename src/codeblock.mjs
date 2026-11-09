// CodeBlock 组件：shiki 语法高亮 → token → canvas 绘制 → PNG
// CodeBlock：github-dark/light 主题 + macOS 三色点
import { createHighlighter } from 'shiki';
import { createCanvas } from 'canvas';

// 单例 highlighter（显式加载语言和主题，长期复用）
let _highlighter = null;

const LANGS = ['javascript', 'typescript', 'python', 'json', 'css', 'html', 'bash', 'shell', 'sql', 'java', 'go', 'rust', 'cpp', 'c', 'markdown'];
const THEMES = ['github-dark', 'github-light'];

async function getHighlighter() {
  if (_highlighter) return _highlighter;
  _highlighter = await createHighlighter({
    themes: THEMES,
    langs: LANGS,
  });
  return _highlighter;
}

// 主题背景色（github-dark 深色 / github-light 浅色）
const THEME_BG = {
  'github-dark': '#0D1117',
  'github-light': '#FFFFFF',
};

// 等宽字体（canvas 可用的等宽字体）
const MONO_FONT = 'Consolas, "Courier New", monospace';

// 代码高亮 → PNG buffer
// 输入：code 字符串, lang, theme, fontSize(px), macHeader, background(可选覆盖)
export async function codeToPng(code, { lang = 'javascript', theme = 'github-dark', fontSize = 12, macHeader = true, background = null } = {}) {
  if (!code) return null;
  try {
    const highlighter = await getHighlighter();
    // 语言降级：未加载的语言 fallback 到 text
    let hlLang = lang;
    if (!LANGS.includes(lang)) {
      // shiki 有 'text' 语言吗？没有的话用 javascript 兜底
      hlLang = 'javascript';
    }
    const { tokens } = await highlighter.codeToTokens(code, {
      lang: hlLang,
      theme,
    });

    // 计算画布尺寸
    const lineHeight = Math.ceil(fontSize * 1.5);
    const paddingX = 16;
    const paddingTop = macHeader ? 40 : 16;
    const paddingBottom = 16;
    // 每行最大字符数 × 字符宽（等宽字体字符宽 ≈ fontSize * 0.6）
    const charW = fontSize * 0.6;
    const maxLineChars = Math.max(...tokens.map((line) => line.reduce((sum, t) => sum + t.content.length, 0)), 1);
    const width = Math.ceil(maxLineChars * charW + paddingX * 2);
    const height = Math.ceil(tokens.length * lineHeight + paddingTop + paddingBottom);

    const bg = background || THEME_BG[theme] || '#0D1117';
    const canvas = createCanvas(Math.max(width, 100), Math.max(height, 40));
    const ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // macOS 三色点
    if (macHeader) {
      const dotY = 20;
      const colors = ['#FF5F56', '#FFBD2E', '#27C93F'];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(paddingX + 8 + i * 20, dotY, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 逐行逐 token 绘制
    ctx.font = `${fontSize}px ${MONO_FONT}`;
    const textBaseline = macHeader ? 40 : 16;
    let y = textBaseline;
    for (const line of tokens) {
      let x = paddingX;
      for (const t of line) {
        ctx.fillStyle = t.color || '#E1E4E8';
        // fontStyle: 1=bold, 2=italic, 3=bold+italic
        const isBold = (t.fontStyle & 1) === 1;
        const isItalic = (t.fontStyle & 2) === 2;
        let font = `${fontSize}px ${MONO_FONT}`;
        if (isBold && isItalic) font = `italic bold ${fontSize}px ${MONO_FONT}`;
        else if (isBold) font = `bold ${fontSize}px ${MONO_FONT}`;
        else if (isItalic) font = `italic ${fontSize}px ${MONO_FONT}`;
        ctx.font = font;
        ctx.fillText(t.content, x, y);
        x += ctx.measureText(t.content).width;
      }
      y += lineHeight;
    }

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.warn(`⚠ CodeBlock 高亮失败: ${e.message}`);
    return null;
  }
}

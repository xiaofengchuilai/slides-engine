// Math 组件：LaTeX → SVG（MathJax）→ PNG
// 方案：MathJax 转 SVG，Node 端用 mathjax-full
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

// 单例：MathJax 初始化一次，复用（避免重复初始化开销）
let _doc = null;
let _adaptor = null;

function getDoc() {
  if (_doc) return _doc;
  _adaptor = liteAdaptor();
  RegisterHTMLHandler(_adaptor);
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: 'none' });
  _doc = mathjax.document('', { InputJax: tex, OutputJax: svg });
  return _doc;
}

// LaTeX → SVG 字符串
// 输入 latex: "E=mc^2" / "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
// 输出 SVG 字符串（含 xmlns）
export function texToSvg(latex, { color = '#000000', display = false } = {}) {
  if (!latex) return null;
  try {
    const doc = getDoc();
    const adaptor = _adaptor;
    const node = doc.convert(latex, { display });
    const html = adaptor.outerHTML(node);
    // 提取内层纯 <svg>（去掉 mjx-container 包裹，node-canvas 需要纯 svg 根）
    let svg = (html.match(/<svg[\s\S]*?<\/svg>/) || [])[0];
    if (!svg) return null;
    // node-canvas 需要 svg 有像素 width/height，且不认 ex 单位
    // 从 viewBox 提取宽高（viewBox 单位可直接当像素用，addImage 时再按 L 尺寸缩放）
    const vb = svg.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/);
    const vw = vb ? Math.ceil(parseFloat(vb[3])) : 1000;
    const vh = vb ? Math.ceil(parseFloat(vb[4])) : 1000;
    svg = svg.replace(/ width="[\d.]+ex"/, ` width="${vw}"`).replace(/ height="[\d.]+ex"/, ` height="${vh}"`);
    // 若指定颜色：currentColor → 目标色
    if (color && color !== '#000000') {
      svg = svg.replace(/currentColor/g, color);
    }
    return svg;
  } catch (e) {
    console.warn(`⚠ Math LaTeX 渲染失败: "${latex}" → ${e.message}`);
    return null;
  }
}

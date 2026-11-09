// SVG 组件：内联 <svg> 节点树 → SVG 字符串 → PNG 位图
// 复用 node-canvas 的 SVG→PNG 能力（与 FAIcon 同链路），PNG 通用兼容
import { loadImage, createCanvas } from 'canvas';

// 把 SVG 节点树序列化成 SVG 字符串
// node: { type:'svg'|'rect'|'circle'|'path'|'g'|'line'|'polygon'|'ellipse', props:{...}, children:[...] }
export function serializeSvg(node) {
  if (!node) return '';
  const tag = node.type;
  const props = node.props || {};

  // 属性序列化：camelCase → kebab-case（cx → cx 不变，strokeWidth → stroke-width）
  const attrs = Object.entries(props)
    .map(([k, v]) => {
      // style 对象特殊处理
      if (k === 'style' && typeof v === 'object') {
        const css = Object.entries(v).map(([sk, sv]) => `${sk}:${sv}`).join(';');
        return `style="${css}"`;
      }
      if (v === true) return k; // 布尔属性
      if (v === false || v == null) return '';
      // camelCase → kebab-case（strokeWidth → stroke-width）
      // 但 SVG 保留驼峰属性要例外：viewBox 必须保持原样（SVG 规范）
      const SVG_CAMEL_KEEP = new Set(['viewBox', 'preserveAspectRatio', 'gradientUnits', 'patternUnits', 'patternContentUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'spreadMethod']);
      const key = SVG_CAMEL_KEEP.has(k) ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      return `${key}="${v}"`;
    })
    .filter(Boolean)
    .join(' ');

  const children = (node.children || [])
    .filter((c) => c !== null && typeof c !== 'undefined')
    .map((c) => (typeof c === 'string' ? c : serializeSvg(c)))
    .join('');

  if (tag === 'svg') {
    // 根 svg 加 xmlns（node-canvas loadImage 需要）
    const xmlns = 'xmlns="http://www.w3.org/2000/svg"';
    return `<svg ${xmlns} ${attrs}>${children}</svg>`;
  }
  return `<${tag} ${attrs}>${children}</${tag}>`;
}

// SVG 字符串 → PNG base64（pptxgenjs addImage 的 data 参数）
export async function svgToPngBase64(svgString) {
  try {
    const img = await loadImage(Buffer.from(svgString));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const buf = canvas.toBuffer('image/png');
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn(`⚠ SVG→PNG 失败: ${e.message}`);
    return null;
  }
}

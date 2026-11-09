// FAIcon 图标：SVG → PNG（用 node-canvas），PNG 通用兼容
// 纯图标名查询（hasIcon/getIconSvg）在 icon-names.mjs（无 canvas），供 validate 使用避免加载 node-canvas
import { loadImage, createCanvas } from 'canvas';
import { getIconSvg } from './icon-names.mjs';

export { getIconSvg, hasIcon } from './icon-names.mjs';

// 把 SVG 渲染成 PNG（PNG 通用兼容，svgBlip 部分预览器不支持）
// 返回 base64 字符串（pptxgenjs addImage 的 data 参数需要）
export async function getIconPng(name, fill) {
  const icon = getIconSvg(name, fill);
  if (!icon) return null;
  try {
    // 加 width/height（node-canvas loadImage 需要）
    let svg = icon.svg.replace('<svg ', '<svg width="512" height="512" ');
    const img = await loadImage(Buffer.from(svg));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const buf = canvas.toBuffer('image/png');
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn(`⚠ FAIcon "${name}" SVG→PNG 失败: ${e.message}`);
    return null;
  }
}

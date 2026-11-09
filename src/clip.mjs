// clipPath 图片裁剪：圆形 / 椭圆（canvas 预裁剪成透明 PNG）
// 支持 style.clipPath（圆形/多边形/SVG path），当前实现最高频的 circle/ellipse
import { loadImage, createCanvas } from 'canvas';
import { readFileSync } from 'node:fs';

// 解析 clipPath 字符串，返回 { type, params }
// 支持：'circle' / 'circle(50%)' / 'ellipse' / 'ellipse(50% 50%)'
function parseClipPath(clip) {
  if (!clip) return null;
  const m = clip.match(/^(circle|ellipse)(?:\(([\d.]+)%(?: ([\d.]+)%)?\))?$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const rx = m[2] ? parseFloat(m[2]) / 100 : 0.5; // 默认 50%
  const ry = m[3] ? parseFloat(m[3]) / 100 : rx;   // ellipse 第二个值，缺省=rx
  return { type, rx, ry };
}

// 图片裁剪：读图 → 按 clipPath 形状裁剪 → 返回 PNG buffer
// 返回 null 表示不支持该 clipPath 或裁剪失败
export async function clipImageToPng(imgPath, clipPath) {
  const parsed = parseClipPath(clipPath);
  if (!parsed) return null; // 不支持的类型（polygon/path 等），返回 null 让调用方 fallback 原图

  try {
    const buf = readFileSync(imgPath);
    const img = await loadImage(buf);
    const w = img.width;
    const h = img.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // 圆形/椭圆裁剪：用路径 + clip
    ctx.save();
    if (parsed.type === 'circle') {
      // 圆形：取短边为直径，居中
      const d = Math.min(w, h);
      const cx = w / 2, cy = h / 2, r = (d / 2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else {
      // 椭圆：rx/ry 按图片宽高比例
      const cx = w / 2, cy = h / 2;
      const rx = w * parsed.rx;
      const ry = h * parsed.ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.warn(`⚠ clipPath 裁剪失败: ${e.message}`);
    return null;
  }
}

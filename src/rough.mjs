// RoughBox 手绘图形：rough.js generator 纯数据模式 → SVG → 供 svgToPngBase64 渲染
// rough.js 的 SVG 模式需要 DOM（Node 无），用 generator() 拿 shape 对象再手动转 SVG path
// roughjs 已本地化到 src/vendor/rough/rough.cjs（MIT 单文件 CJS，含 4 个内置依赖），免 npm 依赖
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const rough = require('./vendor/rough/rough.cjs');

// 单个 shape 对象 → SVG path 元素字符串数组
function shapeToSvgPaths(shape) {
  const o = shape.options || {};
  const parts = [];
  for (const set of shape.sets) {
    let d = '';
    for (const op of set.ops) {
      if (op.op === 'move') d += `M${op.data[0]} ${op.data[1]} `;
      else if (op.op === 'bcurveTo') d += `C${op.data.join(' ')} `;
      else if (op.op === 'lineTo') d += `L${op.data[0]} ${op.data[1]} `;
    }
    if (!d.trim()) continue;
    if (set.type === 'path') {
      parts.push(`<path d="${d.trim()}" fill="none" stroke="${o.stroke}" stroke-width="${o.strokeWidth}"${o.strokeLineDash ? ` stroke-dasharray="${o.strokeLineDash.join(' ')}"` : ''}/>`);
    } else if (set.type === 'fillPath') {
      parts.push(`<path d="${d.trim()}" fill="${o.fill}" stroke="none"/>`);
    } else if (set.type === 'fillSketch') {
      const fw = o.fillWeight < 0 ? o.strokeWidth / 2 : o.fillWeight;
      parts.push(`<path d="${d.trim()}" fill="none" stroke="${o.fill}" stroke-width="${fw}"/>`);
    }
  }
  return parts;
}

// 生成手绘 SVG 字符串（w/h 为画布尺寸，shape 在画布内）
// opts: { shape: 'rect'|'circle'|'ellipse'|'path'|'line'|'polygon'|'curve',
//         x, y, width, height, path(shape=path时), points(shape=line/polygon时),
//         stroke, strokeWidth, roughness, bowing, fill, fillStyle, seed, dash }
export function roughSvg(opts) {
  const gen = rough.generator();
  const o = opts || {};
  const styleOpts = {
    stroke: o.stroke || '#000000',
    strokeWidth: o.strokeWidth || 2,
    roughness: o.roughness !== undefined ? o.roughness : 1.5,
    bowing: o.bowing !== undefined ? o.bowing : 2,
    fill: o.fill || 'none',
    fillStyle: o.fillStyle || 'hachure',
    seed: o.seed,
  };
  // dash 参数：strokeLineDash 数组
  if (o.dash) styleOpts.strokeLineDash = Array.isArray(o.dash) ? o.dash : [o.dash, o.dash];

  let shape = null;
  const shapeType = o.shape || 'rect';
  switch (shapeType) {
    case 'rect':
      shape = gen.rectangle(o.x || 0, o.y || 0, o.width || 100, o.height || 100, styleOpts);
      break;
    case 'circle':
      shape = gen.circle(o.x || 0, o.y || 0, o.diameter || 100, styleOpts);
      break;
    case 'ellipse':
      shape = gen.ellipse(o.x || 0, o.y || 0, o.width || 100, o.height || 60, styleOpts);
      break;
    case 'path':
      shape = gen.path(o.path || '', styleOpts);
      break;
    case 'line':
      shape = gen.line(o.x || 0, o.y || 0, o.x2 || 100, o.y2 || 100, styleOpts);
      break;
    case 'polygon':
      shape = gen.polygon(o.points || [[0, 0], [100, 0], [100, 100]], styleOpts);
      break;
    case 'curve':
      shape = gen.curve(o.points || [[0, 50], [50, 20], [100, 60]], styleOpts);
      break;
    case 'linearPath':
      shape = gen.linearPath(o.points || [[0, 0], [100, 50]], styleOpts);
      break;
    default:
      shape = gen.rectangle(o.x || 0, o.y || 0, o.width || 100, o.height || 100, styleOpts);
  }

  if (!shape) return null;
  const paths = shapeToSvgPaths(shape);
  if (paths.length === 0) return null;

  // 画布 = shape 实际所在区域（外扩 10px 防裁剪）
  const pad = 10;
  const canvasW = (o.width || 100) + pad * 2;
  const canvasH = (o.height || 100) + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <g transform="translate(${pad},${pad})">${paths.join('\n')}</g>
</svg>`;
}

export function hasRoughShape(name) {
  return ['rect', 'circle', 'ellipse', 'path', 'line', 'polygon', 'curve', 'linearPath'].includes(name);
}

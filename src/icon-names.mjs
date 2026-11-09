// 图标名查询（纯同步 fs，不加载 node-canvas）——供 validate 使用
// 注意：validate 只查图标名是否存在，不能为此加载 node-canvas（Windows 退出会 UV_HANDLE_CLOSING 崩溃）
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 找 fontawesome-free 的 svgs 目录
function resolveFontAwesomePath() {
  const candidates = [
    join(__dirname, '../node_modules/@fortawesome/fontawesome-free'),
    join(__dirname, '../../node_modules/@fortawesome/fontawesome-free'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) return c;
  }
  return null;
}

// 图标 style：solid（实心，默认）/ regular / brands
function determineStyle(name) {
  return ['solid', 'regular', 'brands'];
}

// 根据 name 读取 SVG，替换 fill 颜色，返回 SVG 字符串
export function getIconSvg(name, fill) {
  const faPath = resolveFontAwesomePath();
  if (!faPath) return null;

  const styles = determineStyle(name);
  for (const style of styles) {
    const svgPath = join(faPath, 'svgs', style, `${name}.svg`);
    if (existsSync(svgPath)) {
      let svg = readFileSync(svgPath, 'utf-8');
      const color = fill || '#000000';
      svg = svg.replace(/fill="currentColor"/g, `fill="${color}"`);
      return { svg, style, path: svgPath };
    }
  }
  return null;
}

// 判断 name 是否是合法的 FAIcon 名称（快速检查文件是否存在）
export function hasIcon(name) {
  const faPath = resolveFontAwesomePath();
  if (!faPath) return false;
  for (const style of determineStyle(name)) {
    if (existsSync(join(faPath, 'svgs', style, `${name}.svg`))) return true;
  }
  return false;
}

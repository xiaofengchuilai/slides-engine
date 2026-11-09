// 文件收集纯函数：多页文件的收集与排序（供 CLI 与测试复用）
import { readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

// 判断路径是否目录（不存在时返回 false）
export function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch (e) {
    return false;
  }
}

// 收集 .slide 文件：目录 → 递归收集所有 .slide 按路径排序；单文件 → [file]
// 递归：模板库按 content/business/1531.slide 多级存放，必须递归才能批量验证
export function collectSlideFiles(input) {
  if (isDirectory(input)) {
    return collectRecursive(input);
  }
  return [input];
}

function collectRecursive(dir) {
  const result = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    try {
      const st = statSync(p);
      if (st.isDirectory()) {
        result.push(...collectRecursive(p));
      } else if (extname(f) === '.slide') {
        result.push(p);
      }
    } catch (e) { /* 跳过无法访问的条目 */ }
  }
  return result.sort();
}

// 默认输出路径：单文件 → 同名 .pptx；目录 → 目录名.pptx
export function defaultOutPath(input) {
  if (isDirectory(input)) {
    return join(input, basename(input) + '.pptx');
  }
  return input.replace(/\.slide$/, '.pptx');
}

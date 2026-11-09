// CLI 层测试：文件收集 / 排序 / 输出路径
import { collectSlideFiles, defaultOutPath } from './files.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 建临时目录 + 一些 .slide 文件
function makeDeck() {
  const dir = mkdtempSync(join(tmpdir(), 'deck-test-'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

// 1. 目录模式：收集并排序
t('目录模式收集 + 排序', () => {
  const dir = makeDeck();
  writeFileSync(join(dir, '02.slide'), '');
  writeFileSync(join(dir, '01.slide'), '');
  writeFileSync(join(dir, '10.slide'), '');
  writeFileSync(join(dir, 'notes.txt'), ''); // 非 .slide 应被忽略
  const files = collectSlideFiles(dir);
  const names = files.map((f) => f.split(/[\\/]/).pop());
  if (names.join(',') !== '01.slide,02.slide,10.slide') {
    throw new Error(`排序错误：${names.join(',')}`);
  }
  rmSync(dir, { recursive: true, force: true });
});

// 2. 目录模式：忽略非 .slide
t('目录模式忽略非 .slide', () => {
  const dir = makeDeck();
  writeFileSync(join(dir, '01.slide'), '');
  writeFileSync(join(dir, 'readme.md'), '');
  writeFileSync(join(dir, 'image.png'), '');
  const files = collectSlideFiles(dir);
  if (files.length !== 1) throw new Error(`应只收集 1 个，实际 ${files.length}`);
  rmSync(dir, { recursive: true, force: true });
});

// 3. 单文件模式
t('单文件模式', () => {
  const dir = makeDeck();
  const f = join(dir, 'single.slide');
  writeFileSync(f, '');
  const files = collectSlideFiles(f);
  if (files.length !== 1 || files[0] !== f) throw new Error('单文件应原样返回');
  rmSync(dir, { recursive: true, force: true });
});

// 4. 默认输出路径：单文件 → 同名 .pptx
t('默认输出：单文件 .slide → .pptx', () => {
  const p = 'C:/x/foo.slide';
  if (defaultOutPath(p) !== 'C:/x/foo.pptx') throw new Error('单文件应转 .pptx');
});

// 5. 默认输出路径：目录 → 目录名.pptx
t('默认输出：目录 → 目录名.pptx', () => {
  const dir = makeDeck();
  const out = defaultOutPath(dir);
  const expected = join(dir, dir.split(/[\\/]/).pop() + '.pptx');
  if (out !== expected) throw new Error(`应=${expected}，实际=${out}`);
  rmSync(dir, { recursive: true, force: true });
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

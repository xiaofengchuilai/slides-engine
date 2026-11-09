// CLI 入口：.slide → .pptx
// 支持单文件（单页）或目录（目录下所有 .slide 按文件名排序成多页）
// 子命令 validate：跑语法 + 资源完整性校验
import { readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { render } from './output.mjs';
import { collectSlideFiles, defaultOutPath, isDirectory } from './files.mjs';
import { validateProject } from './validate.mjs';

// 用 PowerPoint COM 把单页 pptx 导出 PNG（win32com）
function exportPng(pptxPath, pngOut) {
  const script = [
    "import win32com.client, sys",
    "ppt = win32com.client.Dispatch('PowerPoint.Application')",
    `pres = ppt.Presentations.Open(r'${pptxPath}', WithWindow=False)`,
    `pres.Slides.Item(1).Export(r'${pngOut}', 'PNG', 1280, 720)`,
    "pres.Close()",
    "ppt.Quit()",
  ].join('; ');
  execFileSync('python', ['-c', script], { stdio: 'pipe' });
}

async function main() {
  const args = process.argv.slice(2);

  // validate 子命令：node src/cli.mjs validate <file.slide|目录> [--theme <name>]
  if (args[0] === 'validate') {
    const rest = args.slice(1);
    const inputIdx = rest.findIndex((a) => !a.startsWith('--'));
    if (inputIdx === -1) {
      console.error('用法: node src/cli.mjs validate <file.slide|目录> [--theme <name>]');
      process.exit(1);
    }
    const input = resolve(rest[inputIdx]);
    const themeIdx = rest.indexOf('--theme');
    const theme = themeIdx !== -1 ? rest[themeIdx + 1] : 'business';
    const r = validateProject(input, { theme });

    console.log(`校验 ${r.files} 个页面`);
    for (const f of r.perFile) {
      const name = basename(f.file);
      if (f.errors.length === 0 && f.warnings.length === 0) {
        console.log(`  ✓ ${name} 通过`);
      } else {
        for (const e of f.errors) console.log(`  ✗ ${name}: ${e}`);
        for (const w of f.warnings) console.log(`  ⚠ ${name}: ${w}`);
      }
    }
    console.log(`\n${r.errors.length} 错误, ${r.warnings.length} 警告`);
    console.log(`success: ${r.success}`);
    process.exit(r.success ? 0 : 1);
  }

  // render-png 子命令：单页 .slide → 临时 pptx → win32com 导出 PNG（支撑逐页即时视觉验收）
  // node src/cli.mjs render-png <页.slide> --out <x.png> [--theme name]
  if (args[0] === 'render-png') {
    const rest = args.slice(1);
    const inputIdx = rest.findIndex((a) => !a.startsWith('--'));
    if (inputIdx === -1) {
      console.error('用法: node src/cli.mjs render-png <页.slide> --out <x.png> [--theme name]');
      process.exit(1);
    }
    const input = resolve(rest[inputIdx]);
    const outIdx = rest.indexOf('--out');
    const themeIdx = rest.indexOf('--theme');
    const theme = themeIdx !== -1 ? rest[themeIdx + 1] : 'business';
    const pngOut = outIdx !== -1 ? resolve(rest[outIdx + 1]) : input.replace(/\.slide$/, '.png');

    const source = readFileSync(input, 'utf-8');
    let tree;
    try { tree = executeSlide(source); }
    catch (e) { console.error(`✗ 编译失败: ${e.message}`); process.exit(1); }
    try { layout(tree, { theme }); }
    catch (e) { console.error(`✗ 布局失败: ${e.message}`); process.exit(1); }

    const tmpPptx = pngOut.replace(/\.png$/, '.tmp.pptx');
    const baseDir = dirname(input);
    try { await render([tree], tmpPptx, { theme, baseDir }); }
    catch (e) { console.error(`✗ 生成临时 pptx 失败: ${e.message}`); process.exit(1); }

    try { await exportPng(tmpPptx, pngOut); }
    catch (e) { console.error(`✗ 导出 PNG 失败: ${e.message}`); process.exit(1); }
    try { rmSync(tmpPptx); } catch {}
    console.log(`✓ 导出 ${pngOut}`);
    process.exit(0);
  }


  const inputIdx = args.findIndex((a) => !a.startsWith('--'));
  if (inputIdx === -1) {
    console.error('用法: node src/cli.mjs <file.slide|目录> [--out <out.pptx>] [--theme <name>]');
    console.error('      node src/cli.mjs validate <file.slide|目录> [--theme <name>]');
    process.exit(1);
  }
  const input = resolve(args[inputIdx]);
  const outIdx = args.indexOf('--out');
  const themeIdx = args.indexOf('--theme');
  const theme = themeIdx !== -1 ? args[themeIdx + 1] : 'business';

  const files = collectSlideFiles(input);

  if (files.length === 0) {
    console.error('✗ 未找到任何 .slide 文件');
    process.exit(1);
  }

  const outPath = outIdx !== -1 ? args[outIdx + 1] : defaultOutPath(input);

  const trees = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const source = readFileSync(file, 'utf-8');

    let tree;
    try {
      tree = executeSlide(source);
    } catch (e) {
      console.error(`✗ [编译/执行阶段] 解析 ${file} 失败:`);
      console.error(`  ${e.message}`);
      process.exit(1);
    }

    try {
      layout(tree, { theme });
    } catch (e) {
      console.error(`✗ [布局阶段] ${file} 计算布局失败:`);
      console.error(`  ${e.message}`);
      process.exit(1);
    }

    trees.push(tree);
    console.log(`  ✓ 第 ${i + 1} 页: ${basename(file)}`);
  }

  const baseDir = isDirectory(input) ? input : dirname(input);
  try {
    await render(trees, outPath, { theme, baseDir });
  } catch (e) {
    console.error(`✗ [输出阶段] 生成 ${outPath} 失败:`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  console.log(`✓ 生成 ${outPath}（${trees.length} 页）`);
}

main().catch((e) => {
  console.error('✗ 未预期错误:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});

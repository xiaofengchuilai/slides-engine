// QA 回归入口：单元测试 + 黄金样本对比
// 用法：node scripts/qa-regress.mjs [--unit-only] [--golden-only]
// 退出码：0=全过，1=有失败
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..');
const GOLDEN_DIR = path.join(ENGINE, 'golden');
const args = process.argv.slice(2);
const goldenOnly = args.includes('--golden-only');
const unitOnly = args.includes('--unit-only');

let failed = 0;

// 1. 单元测试
if (!goldenOnly) {
  console.log('=== 1/2 单元测试 ===');
  try {
    const out = execSync(`node --test "${path.join(ENGINE, 'src', '*.test.mjs')}"`, { stdio: 'pipe', encoding: 'utf8', timeout: 180000 });
    const failMatch = out.match(/fail (\d+)/);
    if (failMatch && parseInt(failMatch[1]) > 0) {
      console.log(out.split('\n').filter((l) => l.includes('✗')).slice(0, 10).join('\n'));
      failed++;
    } else {
      const passMatch = out.match(/pass (\d+)/);
      console.log(`✓ 单元测试 ${passMatch ? passMatch[1] : '?'} pass`);
    }
  } catch (e) {
    console.log('✗ 单元测试失败');
    failed++;
  }
}

// 2. 黄金样本对比
if (!unitOnly) {
  console.log('=== ' + (goldenOnly ? '1/1' : '2/2') + ' 黄金样本回归 ===');
  const manifestPath = path.join(GOLDEN_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('⚠ golden/manifest.json 不存在，先跑: node scripts/build-golden.mjs');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-golden-'));
  for (const entry of manifest) {
    const src = path.join(ENGINE, 'references/templates', entry.source);
    const theme = entry.theme || 'business';
    const tmp = path.join(tmpBase, entry.golden);
    try {
      execSync(`node "${path.join(ENGINE, 'src/cli.mjs')}" "${src}" --out "${tmp}" --theme ${theme}`, {
        stdio: 'pipe', encoding: 'utf8', timeout: 60000,
      });
    } catch (e) {
      console.log(`✗ ${entry.name}: 重编译失败`);
      failed++;
      continue;
    }
    try {
      const diffOut = execSync(`python "${path.join(ENGINE, 'scripts/golden-diff.py')}" "${path.join(GOLDEN_DIR, entry.golden)}" "${tmp}"`, {
        stdio: 'pipe', encoding: 'utf8', timeout: 60000,
      });
      console.log(`✓ ${entry.name}: ${diffOut.trim().split('\n')[0]}`);
    } catch (e) {
      console.log(`✗ ${entry.name}:\n${String(e.stdout || '')}`);
      failed++;
    }
  }
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

console.log(failed ? `\n✗ QA 回归 ${failed} 项失败` : '\n✓ QA 回归全部通过');
process.exit(failed ? 1 : 0);

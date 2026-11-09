// QA 批量流水线：全库模板 → 编译成多页 pptx → render-qa.py 几何断言 → 汇总报告
// 用法：node scripts/qa-all.mjs [--type content|cover|...] [--limit N]
// 输出：stdout 报告；退出码 0=无硬错误，1=有硬错误
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, '..');
const TEMPLATES = path.join(ENGINE, 'references', 'templates');
const QA_PY = path.join(__dirname, 'render-qa.py');

const args = process.argv.slice(2);
const typeFilter = (args.find((a) => a.startsWith('--type=')) || '').split('=')[1] || null;
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 0;

// 风格 → 主题映射：深色/特殊风格模板必须用对应主题，否则语义色（cardBg 等）取错变白框
// 否则 business 主题的浅色 cardBg 会让深色模板（tech/black-gold）顶部卡变白
function themeForStyle(style) {
  const map = {
    tech: 'tech',
    'black-gold': 'redgold',
    chinese: 'culture',
    literary: 'culture',
    educational: 'academic',
  };
  return map[style] || 'business';
}

// 收集所有类型/风格目录
const types = fs.readdirSync(TEMPLATES).filter((t) => {
  try { return fs.statSync(path.join(TEMPLATES, t)).isDirectory(); } catch { return false; }
}).filter((t) => !typeFilter || t === typeFilter);

let hardErrors = 0, warnings = 0, ok = 0, total = 0;
const report = [];
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'slides-qa-'));

for (const type of types) {
  const tdir = path.join(TEMPLATES, type);
  const styles = fs.readdirSync(tdir).filter((s) => {
    try { return fs.statSync(path.join(tdir, s)).isDirectory(); } catch { return false; }
  });
  for (const style of styles) {
    const sdir = path.join(tdir, style);
    const slides = fs.readdirSync(sdir).filter((f) => f.endsWith('.slide'));
    if (!slides.length) continue;
    // 按风格编译成多页 pptx（每风格一个，控制编译次数）
    const outPptx = path.join(tmpBase, `${type}_${style}.pptx`);
    const theme = themeForStyle(style);
    try {
      execSync(`node "${path.join(ENGINE, 'src', 'cli.mjs')}" "${sdir}" --out "${outPptx}" --theme ${theme}`, {
        stdio: 'pipe', encoding: 'utf8', timeout: 120000,
      });
    } catch (e) {
      const err = String(e.stdout || e.message || '').split('\n').filter((l) => l.includes('✗') || l.includes('失败')).slice(0, 3).join('; ');
      hardErrors++;
      report.push(`✗ ${type}/${style}: 编译失败 ${err}`);
      continue;
    }
    // render-qa 断言
    try {
      const out = execSync(`python "${QA_PY}" "${outPptx}"`, { stdio: 'pipe', encoding: 'utf8' });
      const text = String(out);
      total += slides.length;
      if (text.includes('✗')) { hardErrors++; report.push(text.trim()); }
      else if (text.includes('警告')) { warnings++; report.push(text.trim()); }
      else { ok += slides.length; }
    } catch (e) {
      const text = String(e.stdout || '');
      total += slides.length;
      if (text.includes('✗')) { hardErrors++; report.push(text.trim()); }
      else { warnings++; report.push(text.trim() || `⚠ ${type}/${style} QA 异常`); }
    }
    if (limit && ok + hardErrors >= limit) break;
  }
  if (limit && ok + hardErrors >= limit) break;
}

fs.rmSync(tmpBase, { recursive: true, force: true });

console.log(`\n===== slides-engine QA 报告 =====`);
console.log(`检查 ${total} 页（${report.length} 个类型/风格批次）`);
console.log(`✓ 通过 ${ok} | ⚠ 警告 ${warnings} | ✗ 硬错误 ${hardErrors}`);
console.log(report.length ? `\n${report.join('\n')}` : '');
process.exit(hardErrors > 0 ? 1 : 0);

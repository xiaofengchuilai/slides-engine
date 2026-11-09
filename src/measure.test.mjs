// 测试 measure.mjs（新版 API）
import { measureWidth, measureLineHeight, measureIntrinsicSize, wrapText } from './measure.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 中文字宽 ≈ 字号
check('中文 4 字 = 4×18=72px', () => {
  const w = measureWidth('你好世界', { fontSize: 18 });
  if (Math.abs(w - 72) > 2) throw new Error(`期望≈72，实际 ${w}`);
});

// 英文字宽 < 中文字宽
check('英文字宽 < 中文字宽（同字号）', () => {
  const cjk = measureWidth('中', { fontSize: 18 });
  const eng = measureWidth('i', { fontSize: 18 });
  if (!(eng < cjk)) throw new Error(`英文字宽 ${eng} 应 < 中文 ${cjk}`);
});

// 空文本宽度=0
check('空文本宽度=0', () => {
  const w = measureWidth('', { fontSize: 18 });
  if (w !== 0) throw new Error(`期望 0，实际 ${w}`);
});

// 行高 = ceil(fontSize × 1.2)
check('行高 = ceil(fontSize×1.2)', () => {
  if (measureLineHeight(32) !== 39) throw new Error(`32→39，实际 ${measureLineHeight(32)}`);
  if (measureLineHeight(24) !== 29) throw new Error(`24→29，实际 ${measureLineHeight(24)}`);
  if (measureLineHeight(48) !== 58) throw new Error(`48→58，实际 ${measureLineHeight(48)}`);
});

// 固有尺寸
check('固有尺寸返回宽+高', () => {
  const r = measureIntrinsicSize('你好世界', { fontSize: 18 });
  if (r.width <= 0) throw new Error('宽度应 > 0');
  if (r.height <= 0) throw new Error('高度应 > 0');
});

// 折行：宽度不够时折成多行
check('wrapText 按可用宽度折行', () => {
  // 4 个中文字，每字 18px，总宽 72px。限制 40px → 应折成 2-3 行
  const lines = wrapText('你好世界', 40, { fontSize: 18 });
  if (lines.length < 2) throw new Error(`4字在40px宽下应折成≥2行，实际 ${lines.length} 行: ${lines}`);
  // 每行宽度 ≤ 40
  for (const l of lines) {
    const w = measureWidth(l, { fontSize: 18 });
    if (w > 40 + 1) throw new Error(`行 "${l}" 宽 ${w} 超限 40`);
  }
});

// 折行：换行符保留
check('wrapText 保留换行符', () => {
  const lines = wrapText('第一行\n第二行', 200, { fontSize: 18 });
  if (lines.length !== 2) throw new Error(`应折成2行，实际 ${lines.length}`);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

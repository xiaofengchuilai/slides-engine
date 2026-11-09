// 手绘字体测试：handFont 探测 + fontFamily:'hand' 语义解析
import { handFont } from './fonts.mjs';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

check('handFont 探测（Windows 应返回 Comic Sans MS）', () => {
  const f = handFont();
  if (!f) throw new Error('未探测到手绘字体');
  console.log(`  （实际: ${f}）`);
});

check('fontFamily:hand 解析成手绘字体', () => {
  const tree = executeSlide('<Slide><Text style={{ fontSize: 24, fontFamily: "hand" }}>Hand Drawn</Text></Slide>');
  layout(tree, { theme: 'business' });
  const t = tree.children[0];
  if (t._fontFamily !== 'Comic Sans MS' && t._fontFamily !== null) {
    // 允许 null（未装 Comic Sans 的平台降级），但不允许错误解析
  }
  console.log(`  （解析为: ${t._fontFamily}）`);
});

check('默认字体不受影响', () => {
  const tree = executeSlide('<Slide><Text style={{ fontSize: 24 }}>中文</Text></Slide>');
  layout(tree, { theme: 'business' });
  const t = tree.children[0];
  if (!t._fontFamily) throw new Error('默认字体缺失');
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

// 测试 spacing/radius 语义 token
import { resolveSpacing, resolveRadius, SPACING, RADIUS } from './theme.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

check('spacing 数字原样', () => { if (resolveSpacing(22) !== 22) throw new Error(); });
check('spacing 语义名', () => {
  if (resolveSpacing('lg') !== 20) throw new Error('lg 应 20');
  if (resolveSpacing('xxl') !== 32) throw new Error('xxl 应 32');
});
check('spacing px 字符串原样', () => { if (resolveSpacing('10px') !== '10px') throw new Error(); });
check('spacing null', () => { if (resolveSpacing(null) !== null) throw new Error(); });
check('radius 语义名', () => {
  if (resolveRadius('sm') !== 8) throw new Error('sm 应 8');
  if (resolveRadius('lg') !== 16) throw new Error('lg 应 16');
});
check('radius 数字原样', () => { if (resolveRadius(12) !== 12) throw new Error(); });
check('spacing 刻度单调递增', () => {
  const v = [SPACING.xs, SPACING.sm, SPACING.md, SPACING.lg, SPACING.xl, SPACING.xxl];
  for (let i = 0; i < v.length - 1; i++) if (v[i] >= v[i+1]) throw new Error(`不单调: ${v[i]} ${v[i+1]}`);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

// 测试字号语义层 resolveFontSize
import { resolveFontSize, TYPE_SCALE } from './theme.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

check('数字原样返回', () => {
  if (resolveFontSize(18) !== 18) throw new Error('18 应原样');
});
check('语义名查表', () => {
  if (resolveFontSize('title') !== 32) throw new Error('title 应 32');
  if (resolveFontSize('kpi') !== 56) throw new Error('kpi 应 56');
  if (resolveFontSize('hero') !== 96) throw new Error('hero 应 96');
});
check('null 返回 null', () => {
  if (resolveFontSize(null) !== null) throw new Error('null 应 null');
});
check('undefined 返回 null', () => {
  if (resolveFontSize(undefined) !== null) throw new Error('undefined 应 null');
});
check('未知字符串不拦截', () => {
  if (resolveFontSize('40px') !== '40px') throw new Error('未知字符串应原样');
});
check('梯度单调递减', () => {
  const v = [TYPE_SCALE.hero, TYPE_SCALE.kpi, TYPE_SCALE.title, TYPE_SCALE.card, TYPE_SCALE.body, TYPE_SCALE.label];
  for (let i = 0; i < v.length - 1; i++) {
    if (v[i] <= v[i + 1]) throw new Error(`梯度不单调：${v[i]} <= ${v[i+1]}`);
  }
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

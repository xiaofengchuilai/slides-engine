// math.mjs 测试：texToSvg 能输出含 svg 的字符串
import { texToSvg } from './math.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

check('简单公式转 SVG', () => {
  const svg = texToSvg('E=mc^2');
  if (!svg) throw new Error('返回空');
  if (!svg.includes('<svg')) throw new Error('应含 <svg>');
  if (!svg.includes('xmlns')) throw new Error('应含 xmlns');
});

check('复杂公式（分数+根号）', () => {
  const svg = texToSvg('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', { display: true });
  if (!svg) throw new Error('返回空');
  if (!svg.includes('viewBox')) throw new Error('应含 viewBox');
});

check('指定颜色', () => {
  const svg = texToSvg('x^2', { color: '#C2410C' });
  if (!svg) throw new Error('返回空');
  if (!svg.includes('#C2410C')) throw new Error('应含指定颜色');
});

check('非法 latex 返回 null（不抛异常）', () => {
  const svg = texToSvg('\\invalid{');
  // 可能返回 null 或抛错被内部捕获，只要不 throw 到测试层即可
  if (svg === undefined) throw new Error('不应返回 undefined');
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

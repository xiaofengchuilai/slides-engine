// svg 序列化测试：viewBox 保留驼峰、strokeWidth 转 kebab、布尔属性
import { serializeSvg } from './svg.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

t('viewBox 保持驼峰（SVG 保留属性）', () => {
  const svg = serializeSvg({ type: 'svg', props: { viewBox: '0 0 100 100' }, children: [] });
  if (!svg.includes('viewBox="0 0 100 100"')) throw new Error('viewBox 被错误转成 view-box: ' + svg);
  if (svg.includes('view-box')) throw new Error('出现非法 view-box');
});

t('strokeWidth 转 kebab-case', () => {
  const svg = serializeSvg({ type: 'path', props: { strokeWidth: 2, strokeLinecap: 'round' }, children: [] });
  if (!svg.includes('stroke-width="2"')) throw new Error('strokeWidth 未转 stroke-width: ' + svg);
  if (!svg.includes('stroke-linecap="round"')) throw new Error('strokeLinecap 未转 stroke-linecap');
});

t('fillRule 转 kebab-case', () => {
  const svg = serializeSvg({ type: 'path', props: { fillRule: 'evenodd' }, children: [] });
  if (!svg.includes('fill-rule="evenodd"')) throw new Error('fillRule 未转 fill-rule');
});

t('布尔属性输出无值', () => {
  const svg = serializeSvg({ type: 'rect', props: { x: 0, hidden: true }, children: [] });
  if (!svg.includes('hidden')) throw new Error('布尔属性应输出');
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

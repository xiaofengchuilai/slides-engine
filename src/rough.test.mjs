// RoughBox 测试：rough.mjs 生成手绘 SVG + 端到端渲染
import { roughSvg, hasRoughShape } from './rough.mjs';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

check('rect 生成 SVG', () => {
  const svg = roughSvg({ shape: 'rect', x: 0, y: 0, width: 200, height: 100, stroke: '#D97706', roughness: 2 });
  if (!svg || !svg.startsWith('<svg')) throw new Error('SVG 生成失败');
  if (!svg.includes('<path')) throw new Error('SVG 无 path');
});
check('circle 生成 SVG', () => {
  const svg = roughSvg({ shape: 'circle', x: 0, y: 0, diameter: 100, fill: '#3B82F6', fillStyle: 'hachure' });
  if (!svg || !svg.includes('<path')) throw new Error();
});
check('path 生成 SVG（波浪线）', () => {
  const svg = roughSvg({ shape: 'path', path: 'M 10 10 Q 100 5, 200 10 T 400 10', stroke: '#F59E0B' });
  if (!svg || !svg.includes('<path')) throw new Error();
});
check('polygon 生成 SVG', () => {
  const svg = roughSvg({ shape: 'polygon', points: [[0,0],[100,0],[100,100]], fill: '#8B5CF6', fillStyle: 'zigzag' });
  if (!svg || !svg.includes('<path')) throw new Error();
});
check('dash 参数生效', () => {
  const svg = roughSvg({ shape: 'rect', width: 100, height: 100, dash: [8, 4] });
  if (!svg.includes('stroke-dasharray')) throw new Error('dash 未生效');
});
check('hasRoughShape 校验', () => {
  if (!hasRoughShape('rect') || hasRoughShape('nonsense')) throw new Error();
});
check('端到端：RoughBox 组件可布局', () => {
  const tree = executeSlide('<Slide><RoughBox shape="rect" style={{ width: 200, height: 120, stroke: "#D97706", roughness: 2, position: "absolute", left: 100, top: 100 }} /></Slide>');
  layout(tree, { theme: 'business' });
  const rb = tree.children[0];
  if (!rb._layout) throw new Error('RoughBox 无布局');
  if (rb._layout.width !== 200) throw new Error(`宽度错误: ${rb._layout.width}`);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

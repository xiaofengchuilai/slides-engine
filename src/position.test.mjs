// 绝对定位测试：position:absolute + top/left 应正确定位（之前 bug：文字溢出画布）
import { executeSlide } from './runtime.mjs';
import { layout, dumpLayout } from './layout.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

t('绝对定位 top/left 生效（不溢出画布）', () => {
  const tree = executeSlide(
    '<Slide><Box style={{position:"absolute", left:80, top:200}}><Text>标题</Text></Box></Slide>'
  );
  layout(tree, { theme: 'business' });
  // 找 Box 的布局
  const box = tree.children.find((c) => c && c.type === 'Box');
  const L = box._layout;
  if (!L) throw new Error('Box 无布局结果');
  if (Math.round(L.x) !== 80) throw new Error(`Box x 应为 80，实际 ${L.x}`);
  if (Math.round(L.y) !== 200) throw new Error(`Box y 应为 200，实际 ${L.y}`);
  if (L.y > 720) throw new Error(`Box y 溢出画布: ${L.y}`);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

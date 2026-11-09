// 测试 layout.mjs（Yoga 版）
import { executeSlide } from './runtime.mjs';
import { layout, dumpLayout } from './layout.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 1. 基本：Box padding + 两个 Text 垂直堆叠
check('Box padding + 垂直堆叠', () => {
  const t = executeSlide('<Slide><Box style={{padding:40}}><Text style={{fontSize:18}}>a</Text><Text style={{fontSize:18}}>b</Text></Box></Slide>');
  layout(t);
  const box = t.children[0];
  const [t1, t2] = box.children;
  // Box 应该占满画布，padding 40
  if (Math.round(box._layout.width) !== 1280) throw new Error('Box 宽度应 1280');
  // 第一个 Text 应在 (40, 40)
  if (Math.round(t1._layout.x) !== 40 || Math.round(t1._layout.y) !== 40) {
    throw new Error(`Text1 应在(40,40)，实际(${t1._layout.x},${t1._layout.y})`);
  }
  // 第二个 Text 应在第一个下方
  if (t2._layout.y <= t1._layout.y) throw new Error('Text2 应在 Text1 下方');
});

// 2. flexDirection: row
check('flexDirection row', () => {
  const t = executeSlide('<Slide><Box style={{flexDirection:"row"}}><Text>a</Text><Text>b</Text></Box></Slide>');
  layout(t);
  const box = t.children[0];
  const [t1, t2] = box.children;
  // row 方向：第二个在第一个右边（x 更大）
  if (!(t2._layout.x > t1._layout.x)) throw new Error('row 方向 Text2 应在 Text1 右边');
});

// 3. 空 Slide
check('空 Slide 不崩', () => {
  const t = executeSlide('<Slide />');
  layout(t);
  if (!t._layout) throw new Error('Slide 应有布局');
});

console.log(`\n${passed} 通过, ${failed} 失败`);
if (failed === 0) {
  // 打印一个示例布局
  console.log('\n=== 示例布局 ===');
  const t = executeSlide('<Slide><Box style={{padding:40}}><Text style={{fontSize:32}}>标题</Text><Text style={{fontSize:18}}>正文</Text></Box></Slide>');
  layout(t);
  console.log(dumpLayout(t));
}
process.exit(failed > 0 ? 1 : 0);

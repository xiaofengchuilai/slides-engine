// 测试工程师的攻击性用例（第二轮）：专打多页/组件/主题/新能力
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

let passed = 0, failed = 0, warn = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}
function w(name, msg) { warn++; console.log(`⚠ ${name} → ${msg}`); }

// 1. 组件参数缺失（KpiCard 没传 desc）
t('组件参数缺失不崩', () => {
  const tree = executeSlide('<Slide><KpiCard number="1" label="x" /></Slide>');
  layout(tree);
});

// 2. 组件传了未定义参数
t('组件多余参数', () => {
  const tree = executeSlide('<Slide><KpiCard number="1" label="x" desc="d" extra="e" /></Slide>');
  layout(tree);
});

// 3. 嵌套组件（组件里用组件）
t('组件嵌套组件', () => {
  const tree = executeSlide('<Slide><Cover title="t" subtitle="s" author="a" /></Slide>');
  layout(tree);
});

// 4. 主题不存在的 fallback
t('未知主题 fallback', () => {
  const tree = executeSlide('<Slide><Text>hi</Text></Slide>');
  layout(tree, { theme: 'nonexistent' });
});

// 5. 深嵌套 + 富文本 + 图片混合
t('混合复杂场景', () => {
  const tree = executeSlide('<Slide><Box style={{background:"primary",padding:20}}><Text>标题 <span style={{bold:true}}>加粗</span></Text><Image src="examples/assets/test.png" style={{width:200,height:100}}/></Box></Slide>');
  layout(tree);
});

// 6. 空 children 的 Box
t('空 Box', () => {
  const tree = executeSlide('<Slide><Box /></Slide>');
  layout(tree);
});

// 7. 极端字号（超大/超小）
t('极端字号', () => {
  const tree = executeSlide('<Slide><Text style={{fontSize:200}}>大</Text><Text style={{fontSize:1}}>小</Text></Slide>');
  layout(tree);
});

// 8. 超长文本（无空格中文长串）
t('超长中文文本', () => {
  const long = '很长的中文文本'.repeat(50);
  const tree = executeSlide(`<Slide><Text>${long}</Text></Slide>`);
  layout(tree);
});

// 9. 组件递归（TOC 用 map，items 缺失）
t('TOC 缺 items', () => {
  const tree = executeSlide('<Slide><TOC /></Slide>');
  layout(tree);
});

// 10. 负值 padding/margin
t('负值 padding', () => {
  const tree = executeSlide('<Slide><Box style={{padding:-10}}><Text>x</Text></Box></Slide>');
  layout(tree);
});

console.log(`\n${passed} 通过, ${failed} 失败, ${warn} 警告`);
process.exit(failed > 0 ? 1 : 0);

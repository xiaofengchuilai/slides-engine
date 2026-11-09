// 攻击性测试：边界/可疑点
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 1. 空 Text
t('空 Text 不崩', () => {
  const tree = executeSlide('<Slide><Text></Text></Slide>');
  layout(tree);
  if (!tree.children[0]._layout) throw new Error('空 Text 无布局');
});

// 2. 富文本嵌套：现已支持，应正常渲染不报错
t('富文本嵌套 → 正常渲染', () => {
  const tree = executeSlide('<Slide><Text>这是<span style={{fontWeight:"bold"}}>加粗</span>文字</Text></Slide>');
  layout(tree);
  const text = tree.children[0];
  if (text._text !== '这是加粗文字') throw new Error(`完整文本不对: "${text._text}"`);
  if (!text._runs || text._runs.length !== 3) throw new Error(`应提取 3 段 runs，实际 ${text._runs?.length}`);
});

// 3. Text 含变量表达式（数字）——已修复，不崩
t('Text 含变量表达式', () => {
  const tree = executeSlide('<Slide><Text>你好 {1+1}</Text></Slide>');
  layout(tree); // 不崩即通过
});

// 4. 根前有注释——已修复
t('根前有注释', () => {
  const tree = executeSlide('// 注释\n<Slide><Text>x</Text></Slide>');
  if (tree.type !== 'Slide') throw new Error('根不是 Slide');
});

// 5. 根后还有语句
t('根后还有语句', () => {
  const tree = executeSlide('<Slide><Text>x</Text></Slide>\nconst y = 1;');
  if (tree.type !== 'Slide') throw new Error('根不是 Slide');
});

// 6. 深嵌套 Box
t('深嵌套 Box', () => {
  const tree = executeSlide('<Slide><Box><Box><Box><Text>x</Text></Box></Box></Box></Slide>');
  layout(tree);
});

// 7. 字面花括号：JSX 标准语义，需用字符串包裹（符合预期，不算 bug）
t('字面花括号需转义（JSX 语义）', () => {
  // 正确写法：{'{花括号}'}
  const tree = executeSlide('<Slide><Text>{"{花括号}"}</Text></Slide>');
  layout(tree);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

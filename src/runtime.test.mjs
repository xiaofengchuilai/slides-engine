// 回归测试：验证 extractRootExpression 能正确处理各种会炸的场景
import { executeSlide, dumpTree } from './runtime.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name} → ${e.message}`);
  }
}

// 1. 基本场景
check('基本 Slide', () => {
  const t = executeSlide('<Slide><Text>hi</Text></Slide>');
  if (t.type !== 'Slide') throw new Error('根不是 Slide');
});

// 2. 函数组件（之前会炸：第一个 createElement 落在函数体）
check('函数组件定义', () => {
  const src = `
    function Badge({ text }) { return <Box>{text}</Box>; }
    <Slide><Badge text="x" /><Text>main</Text></Slide>
  `;
  const t = executeSlide(src);
  if (t.type !== 'Slide') throw new Error('根不是 Slide，而是 ' + t.type);
  const types = t.children.map((c) => c.type);
  if (!types.includes('Box')) throw new Error('缺少 Badge 渲染出的 Box');
});

// 3. 字符串里含 React.createElement 字样（之前会误匹配）
check('字符串含 React.createElement', () => {
  const src = '<Slide><Text>这个字面量 React.createElement( 不该被当代码</Text></Slide>';
  const t = executeSlide(src);
  if (t.type !== 'Slide') throw new Error('根不是 Slide');
});

// 4. 模板字符串
check('模板字符串', () => {
  const src = '<Slide><Text>{`模板 ${1+1}`}</Text></Slide>';
  const t = executeSlide(src);
  if (t.type !== 'Slide') throw new Error('根不是 Slide');
});

// 5. 根组件前有变量声明
check('根前有变量', () => {
  const src = 'const a = 1;\n<Slide><Text>x</Text></Slide>';
  const t = executeSlide(src);
  if (t.type !== 'Slide') throw new Error('根不是 Slide');
});

// 6. Fragment（<>...</>）在 .map() 中可用（此前 React.Fragment 未定义会崩）
check('Fragment 可用', () => {
  const src = `<Slide>{[1,2,3].map((x) => (<><Text>item{x}</Text></>))}</Slide>`;
  const t = executeSlide(src);
  if (t.type !== 'Slide') throw new Error('根不是 Slide');
  if (t.children.length !== 3) throw new Error(`Fragment 应平铺出 3 个子节点，实际 ${t.children.length}`);
  if (t.children[0].type !== 'Text') throw new Error('Fragment 子节点应是 Text');
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

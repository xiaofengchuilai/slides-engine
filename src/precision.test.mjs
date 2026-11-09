// 精确断言测试：具体坐标/字号/行高/单位换算（替换软断言）
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { measureWidth, measureLineHeight } from './measure.mjs';
import { pxToEmu, pxToInch, toPtFontSize } from './units.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// === 单位换算精确断言 ===
t('px→EMU：40px=381000', () => {
  if (pxToEmu(40) !== 381000) throw new Error(`40px 应=381000 EMU，实际 ${pxToEmu(40)}`);
});
t('px→inch：96px=1inch', () => {
  if (pxToInch(96) !== 1) throw new Error('96px 应=1 inch');
});
t('字号换算：32px→24pt', () => {
  if (toPtFontSize(32) !== 24) throw new Error('32 应→24pt');
});
t('字号换算：18px→13.5pt', () => {
  if (toPtFontSize(18) !== 13.5) throw new Error('18 应→13.5pt');
});

// === 行高精确断言 ===
t('行高 32 默认 = 39', () => {
  if (measureLineHeight(32) !== 39) throw new Error(`应 39，实际 ${measureLineHeight(32)}`);
});
t('行高 32 lineHeight=1.5 = 58', () => {
  if (measureLineHeight(32, { lineHeight: 1.5 }) !== 58) throw new Error(`应 58，实际 ${measureLineHeight(32, { lineHeight: 1.5 })}`);
});
t('行高 24 默认 = 29', () => {
  if (measureLineHeight(24) !== 29) throw new Error(`应 29，实际 ${measureLineHeight(24)}`);
});

// === 文本宽度精确断言 ===
t('中文 4 字 18px = 72px', () => {
  const w = measureWidth('你好世界', { fontSize: 18 });
  if (Math.abs(w - 72) > 0.5) throw new Error(`应≈72，实际 ${w}`);
});

// === 布局精确坐标 ===
t('Box padding 40：Text 在 (40,40)', () => {
  const tree = executeSlide('<Slide><Box style={{padding:40}}><Text style={{fontSize:18}}>a</Text></Box></Slide>');
  layout(tree);
  const text = tree.children[0].children[0];
  if (Math.round(text._layout.x) !== 40 || Math.round(text._layout.y) !== 40) {
    throw new Error(`Text 应在(40,40)，实际(${text._layout.x},${text._layout.y})`);
  }
});

t('两个 Text 垂直堆叠：第二个 y = 第一个 y + 行高', () => {
  const tree = executeSlide('<Slide><Box style={{padding:0}}><Text style={{fontSize:32}}>a</Text><Text style={{fontSize:18}}>b</Text></Box></Slide>');
  layout(tree);
  const [t1, t2] = tree.children[0].children;
  const expectedY2 = t1._layout.y + t1._layout.height; // 第二个紧贴第一个底部
  if (Math.abs(t2._layout.y - expectedY2) > 1) {
    throw new Error(`Text2 y 应=${expectedY2}，实际 ${t2._layout.y}`);
  }
});

t('Slide 画布 1280×720', () => {
  const tree = executeSlide('<Slide />');
  layout(tree);
  if (tree._layout.width !== 1280 || tree._layout.height !== 720) {
    throw new Error(`画布应 1280×720，实际 ${tree._layout.width}×${tree._layout.height}`);
  }
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

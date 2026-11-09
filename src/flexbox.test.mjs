// 测试 layout.mjs 新增 flexbox 能力：alignSelf / flexWrap / min-max 尺寸 / 字符串 padding+margin
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

test('字符串 padding 简写：四边同值', () => {
  const t = executeSlide('<Slide><Box style={{padding:"20px"}}><Text style={{fontSize:18}}>a</Text></Box></Slide>');
  layout(t);
  const box = t.children[0];
  const text = box.children[0];
  assert.equal(Math.round(text._layout.x), 20);
  assert.equal(Math.round(text._layout.y), 20);
});

test('字符串 padding 简写：上下/左右两组', () => {
  const t = executeSlide('<Slide><Box style={{padding:"10px 30px"}}><Text style={{fontSize:18}}>a</Text></Box></Slide>');
  layout(t);
  const text = t.children[0].children[0];
  assert.equal(Math.round(text._layout.x), 30);
  assert.equal(Math.round(text._layout.y), 10);
});

test('字符串 padding 简写：四边不同', () => {
  const t = executeSlide('<Slide><Box style={{padding:"5px 10px 15px 20px"}}><Text style={{fontSize:18}}>a</Text></Box></Slide>');
  layout(t);
  const text = t.children[0].children[0];
  assert.equal(Math.round(text._layout.x), 20);
  assert.equal(Math.round(text._layout.y), 5);
});

test('数字 padding 四边同值（回归）', () => {
  const t = executeSlide('<Slide><Box style={{padding:40}}><Text style={{fontSize:18}}>a</Text></Box></Slide>');
  layout(t);
  const text = t.children[0].children[0];
  assert.equal(Math.round(text._layout.x), 40);
  assert.equal(Math.round(text._layout.y), 40);
});

test('flexWrap: wrap 生效（子元素可换行）', () => {
  // 4 个 200px 宽的 Box，容器 400px 宽，wrap 应让它们换行（第 3 个 y > 第 1 个 y）
  const t = executeSlide('<Slide><Box style={{flexDirection:"row", flexWrap:"wrap", width:400}}><Box style={{width:200,height:40}}/><Box style={{width:200,height:40}}/><Box style={{width:200,height:40}}/><Box style={{width:200,height:40}}/></Box></Slide>');
  layout(t);
  const row = t.children[0];
  const [a, b, c, d] = row.children;
  // 前两个在同一行（y 相同），后两个换到下一行（y 更大）
  assert.ok(c._layout.y > a._layout.y, '第 3 个应换行到下一行');
  assert.ok(Math.round(b._layout.y) === Math.round(a._layout.y), '前两个同 y');
});

test('alignSelf: center 生效（单元素交叉轴居中）', () => {
  // 容器 row + align-items flex-start，子元素 align-self center → 子元素 y 不贴顶
  const t = executeSlide('<Slide><Box style={{flexDirection:"row", alignItems:"flex-start", height:200}}><Box style={{width:100,height:40,alignSelf:"center"}}/></Box></Slide>');
  layout(t);
  const row = t.children[0];
  const child = row.children[0];
  // 交叉轴居中：y ≈ (200-40)/2 = 80
  assert.ok(Math.abs(child._layout.y - 80) < 2, `子元素应居中(y≈80)，实际 ${child._layout.y}`);
});

test('minWidth / maxWidth 约束生效', () => {
  const t = executeSlide('<Slide><Box style={{flexDirection:"row"}}><Box style={{width:100,minWidth:150,height:40}}/><Box style={{width:100,maxWidth:50,height:40}}/></Box></Slide>');
  layout(t);
  const row = t.children[0];
  const [a, b] = row.children;
  assert.ok(Math.round(a._layout.width) >= 150, 'minWidth 150 应把宽度拉到 ≥150');
  assert.ok(Math.round(b._layout.width) <= 51, 'maxWidth 50 应把宽度压到 ≤50');
});

test('margin 字符串简写生效', () => {
  const t = executeSlide('<Slide><Box style={{padding:0}}><Box style={{margin:"10px 20px", width:100, height:40}}/></Box></Slide>');
  layout(t);
  const child = t.children[0].children[0];
  assert.equal(Math.round(child._layout.x), 20);
  assert.equal(Math.round(child._layout.y), 10);
});

test('row 布局默认居中对齐：同行大小字混排时小字垂直居中', () => {
  // 容器 row 高 80，内含一个高 60 的大字块和一个高 20 的小字块，不显式设 alignItems
  // 默认应居中对齐：小字块 y ≈ (80-20)/2 = 30，而非贴顶 y=0
  const t = executeSlide('<Slide><Box style={{flexDirection:"row", height:80}}><Box style={{width:100,height:60}}/><Box style={{width:100,height:20}}/></Box></Slide>');
  layout(t);
  const row = t.children[0];
  const small = row.children[1];
  assert.ok(Math.abs(small._layout.y - 30) < 2, `小字块应垂直居中(y≈30)，实际 ${small._layout.y}`);
});

test('row 布局显式 alignItems:flex-start 仍生效（不被默认覆盖）', () => {
  const t = executeSlide('<Slide><Box style={{flexDirection:"row", alignItems:"flex-start", height:80}}><Box style={{width:100,height:60}}/><Box style={{width:100,height:20}}/></Box></Slide>');
  layout(t);
  const row = t.children[0];
  const small = row.children[1];
  assert.ok(Math.abs(small._layout.y) < 2, `显式 flex-start 应贴顶(y≈0)，实际 ${small._layout.y}`);
});

test('column 布局不受影响（默认仍顶部对齐）', () => {
  const t = executeSlide('<Slide><Box style={{height:80}}><Box style={{width:100,height:20}}/><Box style={{width:100,height:20}}/></Box></Slide>');
  layout(t);
  const col = t.children[0];
  const first = col.children[0];
  const second = col.children[1];
  assert.ok(Math.abs(first._layout.y) < 2, `column 首元素应贴顶，实际 ${first._layout.y}`);
  assert.ok(second._layout.y > first._layout.y, 'column 应垂直堆叠');
});

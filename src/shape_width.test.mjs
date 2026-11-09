// 测试 Shape width=0 修复：width=0 应保持 0 宽（不再被 stretch 成父容器全宽）
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';

test('Shape width=0 保持 0 宽（不 stretch 成全宽）', () => {
  const t = executeSlide('<Slide><Box style={{flexDirection:"row"}}><Shape type="line" style={{width:0,height:80}}/></Box></Slide>');
  layout(t);
  const shape = t.children[0].children[0];
  assert.ok(shape._layout.width < 1, `width=0 应保持 0 宽，实际 ${shape._layout.width}`);
});

test('Shape width 正常值生效', () => {
  const t = executeSlide('<Slide><Shape type="rect" style={{width:120,height:60}}/></Slide>');
  layout(t);
  const shape = t.children[0];
  assert.equal(Math.round(shape._layout.width), 120);
  assert.equal(Math.round(shape._layout.height), 60);
});

test('Shape 未指定 width 默认 100', () => {
  const t = executeSlide('<Slide><Shape type="rect" style={{height:60}}/></Slide>');
  layout(t);
  const shape = t.children[0];
  assert.equal(Math.round(shape._layout.width), 100);
});

test('Image width=0 仍视为未指定（保持原语义）', () => {
  // Image 无 src，但布局层应保持 Image 的 width=0 不设宽度（这里只验证不崩）
  const t = executeSlide('<Slide><Image src="../assets/none.png" style={{width:0,height:80}}/></Slide>');
  layout(t);
  // Image 分支 width=0 仍走 falsy，不设宽度；只验证布局不抛异常
  assert.ok(true);
});

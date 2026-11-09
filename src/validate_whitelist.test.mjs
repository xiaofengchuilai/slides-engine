// 测试 validate.mjs 的 style 属性白名单校验
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSlide } from './validate.mjs';

test('支持属性不报 warning', () => {
  const { warnings } = validateSlide('<Slide><Box style={{flexDirection:"row",gap:16,padding:20,background:"#fff",borderRadius:8}}/></Slide>');
  assert.equal(warnings.length, 0, `不应有 warning，实际 ${warnings.join('; ')}`);
});

test('不支持属性报 warning（flexWrap 已支持，改用 grid）', () => {
  const { warnings } = validateSlide('<Slide><Box style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}/></Slide>');
  assert.ok(warnings.some((w) => w.includes('display')), 'display:grid 应报 warning');
});

test('不支持属性 gridTemplateColumns 报 warning', () => {
  const { warnings } = validateSlide('<Slide><Box style={{gridTemplateColumns:"1fr"}}/></Slide>');
  assert.ok(warnings.some((w) => w.includes('gridTemplateColumns')), 'gridTemplateColumns 应报 warning');
});

test('Box 支持 boxShadow / opacity（不再报 warning）', () => {
  const { warnings } = validateSlide('<Slide><Box style={{boxShadow:"2px 2px 8px rgba(0,0,0,0.3)",opacity:0.5,background:"#fff"}}/></Slide>');
  assert.equal(warnings.length, 0, `boxShadow/opacity 应支持，实际 warning ${warnings.join('; ')}`);
});

test('Box 支持 flexWrap / alignSelf / min-max（不再报 warning）', () => {
  const { warnings } = validateSlide('<Slide><Box style={{flexWrap:"wrap",alignSelf:"center",minWidth:100,maxHeight:200}}/></Slide>');
  assert.equal(warnings.length, 0, `flexWrap/alignSelf/min-max 应支持，实际 warning ${warnings.join('; ')}`);
});

test('Text 支持 opacity / fontWeight 数值 / textDecoration（不再报 warning）', () => {
  const { warnings } = validateSlide('<Slide><Text style={{opacity:0.5,fontWeight:700,textDecoration:"line-through",fontSize:18}}>x</Text></Slide>');
  assert.equal(warnings.length, 0, `Text 新属性应支持，实际 warning ${warnings.join('; ')}`);
});

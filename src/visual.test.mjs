// 测试 output.mjs 新增视觉属性：Box boxShadow/opacity、Text opacity/fontWeight数值/line-through
import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { render } from './output.mjs';
import JSZip from 'jszip';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function genXml(source) {
  const dir = mkdtempSync(join(tmpdir(), 'vis-test-'));
  const out = join(dir, 'out.pptx');
  const tree = executeSlide(source);
  layout(tree, { theme: 'business' });
  await render(tree, out, { theme: 'business' });
  const buf = readFileSync(out);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  rmSync(dir, { recursive: true, force: true });
  return xml;
}

test('Box boxShadow 输出 shadow 元素', async () => {
  const xml = await genXml('<Slide><Box style={{background:"#FFFFFF",boxShadow:"2px 2px 8px rgba(0,0,0,0.3)",width:100,height:100}}/></Slide>');
  assert.ok(/effectLst|outerShdw|shadow/i.test(xml), '应含阴影 effectLst/outerShdw');
});

test('Box opacity 输出 transparency', async () => {
  const xml = await genXml('<Slide><Box style={{background:"#1E3A8A",opacity:0.5,width:100,height:100}}/></Slide>');
  // opacity 0.5 → transparency 50
  assert.ok(xml.includes('alpha') || xml.includes('50000') || /alpha[^>]*val="50000"/.test(xml), '应含 50% transparency(alpha=50000)');
});

test('Text opacity 输出 transparency', async () => {
  const xml = await genXml('<Slide><Text style={{fontSize:18,opacity:0.3}}>文字</Text></Slide>');
  // opacity 0.3（30% 不透明）→ alpha=30000
  assert.ok(/alpha[^>]*val="30000"/.test(xml), '应含 30% alpha（对应 opacity 0.3）');
});

test('Text fontWeight 数值 700 降级为 bold', async () => {
  const xml = await genXml('<Slide><Text style={{fontSize:18,fontWeight:700}}>加粗</Text></Slide>');
  assert.ok(/b="1"/.test(xml) || /b="true"/.test(xml), 'fontWeight 700 应输出 bold');
});

test('Text textDecoration line-through 输出 strike', async () => {
  const xml = await genXml('<Slide><Text style={{fontSize:18,textDecoration:"line-through"}}>删除线</Text></Slide>');
  assert.ok(/strike="sngStrike"/.test(xml) || /strike="1"/.test(xml) || /strike/i.test(xml), '应含 strike');
});

// 能力补全测试：boxShadow / rotate / emoji
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSlide } from './validate.mjs';
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { render } from './output.mjs';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { emojiCodepoint } from './emoji.mjs';

// ── Step 1: boxShadow 放行 ──
test('Box boxShadow 不再报 warning', () => {
  const src = '<Slide><Box style={{ width: 100, height: 60, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}><Text>hi</Text></Box></Slide>';
  const r = validateSlide(src);
  assert.equal(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  assert.equal(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});

test('Shape boxShadow 不再报 warning', () => {
  const src = '<Slide><Shape type="rect" style={{ width: 100, height: 60, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} /></Slide>';
  const r = validateSlide(src);
  assert.equal(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  assert.equal(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});

test('boxShadow 渲染输出 outerShdw', async () => {
  const tree = executeSlide('<Slide><Box style={{ width: 200, height: 120, background: "#FFFFFF", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}><Text>t</Text></Box></Slide>');
  layout(tree, { theme: 'business' });
  const dir = mkdtempSync(join(tmpdir(), 'sh-'));
  const out = join(dir, 'x.pptx');
  await render(tree, out, { theme: 'business' });
  // 解包看 XML
  execSync(`powershell -Command "Copy-Item '${out}' '${join(dir, 'x.zip')}' -Force; Expand-Archive '${join(dir, 'x.zip')}' -DestinationPath '${join(dir, 'u')}' -Force"`, { stdio: 'pipe' });
  const xml = readFileSync(join(dir, 'u', 'ppt', 'slides', 'slide1.xml'), 'utf8');
  assert.ok(/outerShdw|effectLst/.test(xml), 'XML 应含 outerShdw/effectLst');
});

// ── Step 2: rotate 放行（基础验证，包围盒在布局层）──
test('Box rotate 不再报 warning', () => {
  const src = '<Slide><Box style={{ width: 100, height: 60, rotate: 15, position: "absolute", left: 100, top: 100 }}><Text>t</Text></Box></Slide>';
  const r = validateSlide(src);
  assert.equal(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  assert.equal(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});

test('Shape rotate 不再报 warning', () => {
  const src = '<Slide><Shape type="rect" style={{ width: 100, height: 60, rotate: 45 }} /></Slide>';
  const r = validateSlide(src);
  assert.equal(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  assert.equal(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});

// ── Step 3: Emoji 组件 ──
test('Emoji validate 通过', () => {
  const src = '<Slide><Emoji name="💰" style={{ width: 48, height: 48 }} /></Slide>';
  const r = validateSlide(src);
  assert.equal(r.errors.length, 0, `errors: ${r.errors.join('; ')}`);
  assert.equal(r.warnings.length, 0, `warnings: ${r.warnings.join('; ')}`);
});

test('Emoji 渲染输出图片（有 media）', async () => {
  const tree = executeSlide('<Slide><Emoji name="💰" style={{ width: 48, height: 48 }} /></Slide>');
  layout(tree, { theme: 'business' });
  const dir = mkdtempSync(join(tmpdir(), 'emo-',));
  const out = join(dir, 'x.pptx');
  await render(tree, out, { theme: 'business' });
  execSync(`powershell -Command "Copy-Item '${out}' '${join(dir, 'x.zip')}' -Force; Expand-Archive '${join(dir, 'x.zip')}' -DestinationPath '${join(dir, 'u')}' -Force"`, { stdio: 'pipe' });
  const rels = readFileSync(join(dir, 'u', 'ppt', 'slides', '_rels', 'slide1.xml.rels'), 'utf8');
  assert.ok(/image/.test(rels), 'rels 应含图片引用');
});

test('emojiCodepoint 正确', () => {
  assert.equal(emojiCodepoint('💰'), '1f4b0');
  assert.equal(emojiCodepoint('❤️'), '2764'); // 去 FE0F
});

// ── Step 4: Image 缺文件兑底 ──
test('Image 文件不存在不崩（跳过+warning）', async () => {
  const tree = executeSlide('<Slide><Box style={{ height: 100, width: 200 }}><Image src="assets/images/nonexistent.png" style={{ width: 100, height: 100 }} /></Box></Slide>');
  layout(tree, { theme: 'business' });
  const dir = mkdtempSync(join(tmpdir(), 'imgmiss-'));
  const out = join(dir, 'x.pptx');
  // 不抛错即通过
  await render(tree, out, { theme: 'business' });
  assert.ok(existsSync(out), 'pptx 应生成');
  assert.ok(readFileSync(out).length > 1000, 'pptx 非空');
});

test('Image 文件存在正常渲染', async () => {
  // 用 emoji 资源目录里的真实 PNG 当图
  const emojiPng = join('src', 'assets', 'emoji', '1f4b0.png');
  if (!existsSync(emojiPng)) return; // 资源缺失时跳过
  const tree = executeSlide(`<Slide><Box style={{ height: 100, width: 200 }}><Image src="${emojiPng}" style={{ width: 100, height: 100 }} /></Box></Slide>`);
  layout(tree, { theme: 'business' });
  const dir = mkdtempSync(join(tmpdir(), 'imgok-'));
  const out = join(dir, 'x.pptx');
  await render(tree, out, { theme: 'business' });
  assert.ok(existsSync(out), 'pptx 应生成');
});

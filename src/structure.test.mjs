// 结构级回归门禁：把已知的坑固化成自动化断言，防止回归
// 覆盖：txBox 标记、bold 字体测量、numFmt sourceLinked、无非法 prstGeom、SVG 不落盘
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { render } from './output.mjs';
import { measureWidth } from './measure.mjs';
import JSZip from 'jszip';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let passed = 0, failed = 0;
function t(name, fn) {
  return async () => {
    try { await fn(); passed++; console.log(`✓ ${name}`); }
    catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
  };
}

// 生成 pptx 并解包（返回 slideXml + zip 内全部文件 + 可选 chartXml）
async function genAndParse(source, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'slides-struct-'));
  const out = join(dir, 'out.pptx');
  const tree = executeSlide(source);
  layout(tree, { theme: opts.theme || 'business' });
  await render(tree, out, opts);
  const buf = readFileSync(out);
  const zip = await JSZip.loadAsync(buf);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');
  const files = Object.keys(zip.files);
  const chartFile = files.find((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f));
  const chartXml = chartFile ? await zip.file(chartFile).async('string') : null;
  rmSync(dir, { recursive: true, force: true });
  return { slideXml, files, chartXml };
}

const tests = [
  // 1. 文本 shape 必须有 txBox="1"（预览器识别文本框的标记，缺了会错乱）
  t('文本 shape 含 txBox="1"', async () => {
    const { slideXml } = await genAndParse('<Slide><Text>测试</Text></Slide>');
    if (!slideXml.includes('txBox="1"')) throw new Error('文本 shape 缺少 txBox="1"');
  }),

  // 2. 文本 shape 的 cNvPr 应有 descr 标记
  t('文本 shape cNvPr 含 isTemplate descr', async () => {
    const { slideXml } = await genAndParse('<Slide><Text>x</Text></Slide>');
    if (!slideXml.includes('isTemplate')) throw new Error('cNvPr 缺少 isTemplate descr');
  }),

  // 3. bold 字体测量必须宽于 regular（未注册 bold 字体会 fallback 导致测量偏小）
  t('bold 字体测量宽于 regular（bold 字体已注册）', async () => {
    const regular = measureWidth('01', { fontSize: 28, fontFamily: 'Microsoft YaHei' });
    const bold = measureWidth('01', { fontSize: 28, fontFamily: 'Microsoft YaHei', fontWeight: 'bold' });
    if (!(bold > regular)) throw new Error(`bold 测量 ${bold} 应 > regular ${regular}`);
  }),

  // 4. 图表 numFmt sourceLinked 应为 0（=1 会让部分预览器横轴显示 0,1,2,3）
  t('图表 numFmt sourceLinked=0', async () => {
    const { chartXml } = await genAndParse(
      '<Slide><Chart chartType="barChart" data={[["季度","2025"],["Q1",120],["Q2",156]]} /></Slide>'
    );
    if (!chartXml) throw new Error('未找到 chart XML');
    if (chartXml.includes('sourceLinked="1"')) throw new Error('图表含 sourceLinked="1"，应为 0');
  }),

  // 5. 不允许出现非法的 prstGeom 值（如 customGeometry，会导致 PowerPoint 打不开）
  t('无非法 prstGeom 值', async () => {
    const { slideXml } = await genAndParse('<Slide><Box style={{background:"#333"}}/><Text>x</Text></Slide>');
    if (slideXml.includes('prst="customGeometry"')) throw new Error('出现非法 prstGeom 值 customGeometry');
  }),

  // 6. FAIcon 应输出 PNG 位图（svg 文件不落盘，绕开 svgBlip 兼容问题）
  t('FAIcon 输出 PNG 不落 SVG', async () => {
    const { files } = await genAndParse('<Slide><FAIcon name="heart" style={{fill:"#3b82f6",width:32,height:32}}/></Slide>');
    const hasPng = files.some((f) => f.endsWith('.png'));
    const hasSvg = files.some((f) => f.endsWith('.svg'));
    if (!hasPng) throw new Error('FAIcon 应输出 PNG 位图');
    if (hasSvg) throw new Error('FAIcon 不应落盘 SVG（应已转 PNG）');
  }),
];

for (const test of tests) {
  await test();
}
console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

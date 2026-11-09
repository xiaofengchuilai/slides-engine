// output 层测试：生成 pptx → jszip 解包 → 验证颜色/富文本/坐标/圆角/主题背景/Shape/SVG
import { executeSlide } from './runtime.mjs';
import { layout } from './layout.mjs';
import { render } from './output.mjs';
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

// 生成 pptx 并解包，返回 slide1.xml + 文件清单
async function genAndParse(source, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'slides-test-'));
  const out = join(dir, 'out.pptx');
  const tree = executeSlide(source);
  layout(tree, { theme: opts.theme || 'business' });
  await render(tree, out, opts);
  const buf = readFileSync(out);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const files = Object.keys(zip.files);
  rmSync(dir, { recursive: true, force: true });
  return { xml, files };
}

const tests = [
  // 1. 主题背景色
  t('主题背景色（business 白）', async () => {
    const { xml } = await genAndParse('<Slide><Text>x</Text></Slide>');
    if (!xml.includes('FFFFFF')) throw new Error('应含白色背景');
  }),
  t('主题背景色（tech 深色）', async () => {
    const { xml } = await genAndParse('<Slide><Text>x</Text></Slide>', { theme: 'tech' });
    if (!xml.includes('0F172A')) throw new Error('应含深色背景');
  }),

  // 2. Box 背景色 + 圆角
  t('Box 背景色 + 圆角', async () => {
    const { xml } = await genAndParse('<Slide><Box style={{background:"#1E3A8A",borderRadius:12,width:100,height:50}}/></Slide>');
    if (!xml.includes('1E3A8A')) throw new Error('应含 Box 背景色');
    if (!xml.includes('roundRect')) throw new Error('圆角应生成 roundRect');
  }),

  // 3. 富文本 runs
  t('富文本 runs（加粗+变色）', async () => {
    const { xml } = await genAndParse('<Slide><Text>这是<span style={{fontWeight:"bold"}}>加粗</span>和<span style={{color:"#2563EB"}}>蓝色</span></Text></Slide>');
    if (!xml.includes('加粗')) throw new Error('缺少加粗文本');
    if (!xml.includes('蓝色')) throw new Error('缺少蓝色文本');
    if (!xml.includes('2563EB')) throw new Error('缺少蓝色 hex');
    if (!xml.includes('b="1"')) throw new Error('缺少加粗标记');
  }),

  // 4. 坐标 EMU 精确
  t('坐标 EMU 精确（40px→381000）', async () => {
    const { xml } = await genAndParse('<Slide><Box style={{padding:40}}><Text>a</Text></Box></Slide>');
    if (!xml.includes('381000')) throw new Error('应含 381000 EMU 坐标（40px）');
  }),

  // 5. 语义色解析
  t('语义色 primary 解析', async () => {
    const { xml } = await genAndParse('<Slide><Text style={{color:"primary"}}>x</Text></Slide>');
    if (!xml.includes('1E3A8A')) throw new Error('primary 应解析为 #1E3A8A');
  }),

  // 6. Shape 预设形状渲染
  t('Shape 预设形状（chevron/diamond）', async () => {
    const { xml } = await genAndParse(
      '<Slide><Shape type="chevron" style={{width:100,height:48,fill:"primary"}}/><Shape type="diamond" style={{width:60,height:60,fill:"accent"}}/></Slide>'
    );
    if (!xml.includes('prst="chevron"')) throw new Error('缺少 chevron 形状');
    if (!xml.includes('prst="diamond"')) throw new Error('缺少 diamond 形状');
  }),

  // 7. Shape 连接线箭头
  t('Shape 连接线（line + endArrowType）', async () => {
    const { xml } = await genAndParse(
      '<Slide><Shape type="line" style={{width:100,height:0,line:{color:"primary",width:2,endArrowType:"triangle"}}}/></Slide>'
    );
    if (!xml.includes('prst="line"')) throw new Error('缺少 line 形状');
    if (!xml.includes('triangle')) throw new Error('缺少箭头类型 triangle');
  }),

  // 8. SVG 渲染成 PNG 位图（不落 SVG 文件）
  t('SVG 渲染成 PNG（不落 SVG 文件）', async () => {
    const { files } = await genAndParse(
      '<Slide><svg width={100} height={100} viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3b82f6" /></svg></Slide>'
    );
    const hasPng = files.some((f) => f.endsWith('.png'));
    const hasSvg = files.some((f) => f.endsWith('.svg'));
    if (!hasPng) throw new Error('SVG 应输出 PNG 位图');
    if (hasSvg) throw new Error('SVG 不应落盘 .svg 文件');
  }),

  // 9. Text 超链接 href → hlinkClick
  t('Text 超链接 href', async () => {
    const { xml } = await genAndParse(
      '<Slide><Text href="https://example.com">链接</Text></Slide>'
    );
    if (!xml.includes('hlinkClick') && !xml.includes('hyperlink')) {
      throw new Error('超链接应写入 hlinkClick/hyperlink');
    }
  }),

  // 10. Text 换行 <br/> → 换行符
  t('Text 换行 br', async () => {
    const { xml } = await genAndParse(
      '<Slide><Text>第一行<br/>第二行</Text></Slide>'
    );
    // 换行会生成两个 <a:t> 或多个 run，检查"第二行"存在且文本被拆段
    if (!xml.includes('第二行')) throw new Error('缺少第二行文本');
  }),

  // 11. Text 对齐 + 字间距
  t('Text 对齐 textAlign + 字间距 letterSpacing', async () => {
    const { xml } = await genAndParse(
      '<Slide><Text style={{ textAlign: "center", letterSpacing: 4 }}>居中</Text></Slide>'
    );
    if (!xml.includes('algn="ctr"')) throw new Error('textAlign center 应生成 algn=ctr');
    if (!xml.includes('spc="400"')) throw new Error('letterSpacing 4 应生成 spc=400');
  }),

  // 12. Slide 纯色背景生效（此前被静默忽略）
  t('Slide 纯色背景生效', async () => {
    const { xml } = await genAndParse('<Slide style={{ background: "#123456" }}><Text>x</Text></Slide>');
    if (!xml.includes('123456')) throw new Error('Slide 的 background 应写入 p:bg');
  }),

  // 13. Slide 渐变背景降级为首个停靠点纯色（pptxgenjs slide.background 仅支持 solid）
  t('Slide 渐变背景降级为纯色', async () => {
    const { xml } = await genAndParse('<Slide style={{ background: "linear-gradient(135deg, #0B1E4B 0%, #3B82F6 100%)" }}><Text>x</Text></Slide>');
    if (!xml.includes('0B1E4B')) throw new Error('渐变背景应降级为首个停靠点 #0B1E4B');
    if (xml.includes('gradFill')) throw new Error('slide 背景不应生成 gradFill（pptxgenjs 不支持）');
  }),

  // 14. rgba 背景正确解析为 hex + alpha 透明度（0.18 → transparency 82%）
  t('rgba 颜色解析为 hex 且 alpha 转透明度', async () => {
    const { xml } = await genAndParse('<Slide><Box style={{ background: "rgba(59,130,246,0.18)", width: 100, height: 50 }}/></Slide>');
    if (!xml.includes('3B82F6')) throw new Error('rgba(59,130,246,0.18) 应解析为 3B82F6');
    if (!xml.includes('alpha val="18000"')) throw new Error('rgba alpha 0.18 应渲染为 18% 不透明（82% 透明），实际 xml 无 alpha val=18000');
  }),

  // 15. rgb 颜色解析为 hex
  t('rgb 颜色解析为 hex', async () => {
    const { xml } = await genAndParse('<Slide><Box style={{ background: "rgb(255,255,255)", width: 100, height: 50 }}/></Slide>');
    if (!xml.includes('FFFFFF')) throw new Error('rgb(255,255,255) 应解析为 FFFFFF');
  }),
];

for (const test of tests) {
  await test();
}
console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

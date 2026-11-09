// gradient.mjs 测试：解析 linear-gradient + 生成 gradFill XML
import { parseLinearGradient, buildGradFillXml, gradientTag, stopsFromTagColors } from './gradient.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 1. 双色渐变解析
check('双色渐变解析', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #431407 0%, #F59E0B 100%)');
  if (!g) throw new Error('解析失败');
  if (g.angle !== 135) throw new Error(`角度应 135，实际 ${g.angle}`);
  if (g.stops.length !== 2) throw new Error(`应 2 停靠点，实际 ${g.stops.length}`);
  if (g.stops[0].color !== '431407' || g.stops[0].pos !== 0) throw new Error(`首停靠点错误 ${JSON.stringify(g.stops[0])}`);
  if (g.stops[1].color !== 'F59E0B' || g.stops[1].pos !== 100) throw new Error(`尾停靠点错误 ${JSON.stringify(g.stops[1])}`);
});

// 2. 三色渐变解析
check('三色渐变解析', () => {
  const g = parseLinearGradient('linear-gradient(90deg, #C2410C 0%, #F59E0B 50%, #431407 100%)');
  if (g.stops.length !== 3) throw new Error(`应 3 停靠点，实际 ${g.stops.length}`);
  if (g.stops[1].pos !== 50) throw new Error(`中间停靠点应 50，实际 ${g.stops[1].pos}`);
});

// 3. 无位置自动等分
check('无位置停靠点自动等分', () => {
  const g = parseLinearGradient('linear-gradient(0deg, #111111, #222222)');
  if (!g) throw new Error('解析失败');
  if (g.stops[0].pos !== 0 || g.stops[1].pos !== 100) throw new Error(`等分失败 ${JSON.stringify(g.stops)}`);
});

// 4. gradFill XML 含 lin + gs
check('gradFill XML 生成', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #431407 0%, #F59E0B 100%)');
  const xml = buildGradFillXml(g);
  if (!xml.includes('<a:gradFill')) throw new Error('缺 gradFill');
  if (!xml.includes('<a:lin ang=')) throw new Error('缺 lin');
  if (!xml.includes('431407') || !xml.includes('F59E0B')) throw new Error('缺颜色');
});

// 5. 非法输入返回 null
check('非法渐变返回 null', () => {
  if (parseLinearGradient('red') !== null) throw new Error('应返回 null');
  if (parseLinearGradient('linear-gradient(135deg, #111111)') !== null) throw new Error('单色应返回 null');
});

// 6. gradientTag 生成标记
check('gradientTag 生成标记', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #431407 0%, #F59E0B 100%)');
  const tag = gradientTag(g.angle, g.stops);
  if (!tag.startsWith('GRAD_135_')) throw new Error(`标记错误 ${tag}`);
});

// ===== 2026-09-11 修复回归：rgba/rgb 端点 =====
// 背景：rgba 内部的逗号被天真 split(',') 切开，裸数字 "255" 被当 3 位 hex → #225555（青绿）

// 7. rgba 端点（末页渐变覆盖层写法）—— 关键回归
check('rgba 端点解析（不得产生 225555）', () => {
  const g = parseLinearGradient('linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.30) 100%)');
  if (!g) throw new Error('解析失败');
  if (g.stops.length !== 2) throw new Error(`应 2 停靠点，实际 ${g.stops.length}`);
  if (g.stops[0].color !== 'FFFFFF') throw new Error(`首停靠点应 FFFFFF，实际 ${g.stops[0].color}`);
  if (g.stops[1].color !== '000000') throw new Error(`尾停靠点应 000000，实际 ${g.stops[1].color}`);
  if (g.stops.some((s) => s.color === '225555')) throw new Error('不得再出现 225555（裸数字误当 hex）');
  if (g.stops[0].alpha !== 0.16) throw new Error(`首停靠点 alpha 应 0.16，实际 ${g.stops[0].alpha}`);
  if (g.stops[1].alpha !== 0.30) throw new Error(`尾停靠点 alpha 应 0.3，实际 ${g.stops[1].alpha}`);
});

// 8. rgb 无 alpha 端点
check('rgb 端点解析', () => {
  const g = parseLinearGradient('linear-gradient(90deg, rgb(255,0,0) 0%, rgb(0,0,255) 100%)');
  if (!g) throw new Error('解析失败');
  if (g.stops[0].color !== 'FF0000') throw new Error(`应 FF0000，实际 ${g.stops[0].color}`);
  if (g.stops[1].color !== '0000FF') throw new Error(`应 0000FF，实际 ${g.stops[1].color}`);
  if (g.stops[0].alpha !== undefined) throw new Error('rgb 无 alpha 不应带 alpha 字段');
});

// 9. 语义 token + rgba 混合（之前直接返回 null）
check('token + rgba 混合端点', () => {
  const g = parseLinearGradient('linear-gradient(160deg, deep 0%, rgba(0,0,0,0.3) 100%)');
  if (!g) throw new Error('解析失败');
  if (g.stops.length !== 2) throw new Error(`应 2 停靠点，实际 ${g.stops.length}`);
  if (!g.stops[0].token || g.stops[0].color !== 'deep') throw new Error(`首停靠点应 token deep，实际 ${JSON.stringify(g.stops[0])}`);
  if (g.stops[1].color !== '000000') throw new Error(`尾停靠点应 000000，实际 ${g.stops[1].color}`);
});

// 10. hex 仍正常（回归）+ 裸数字不得当颜色
check('hex 端点回归 + 裸数字不当颜色', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #431407 0%, #F59E0B 100%)');
  if (g.stops[0].color !== '431407') throw new Error(`hex 解析回归失败 ${g.stops[0].color}`);
  // 'FFAA00' 无 # 不再是合法颜色 → 该停靠点被跳，stops < 2 → null
  const bad = parseLinearGradient('linear-gradient(135deg, FFAA00 0%, 112233 100%)');
  if (bad !== null) throw new Error('无 # 的裸 hex 不应被当颜色');
});

// 11. 三位 hex 仍支持（带 #）
check('三位 hex（带 #）仍支持', () => {
  const g = parseLinearGradient('linear-gradient(0deg, #F00 0%, #00F 100%)');
  if (!g) throw new Error('解析失败');
  if (g.stops[0].color !== 'FF0000') throw new Error(`应 FF0000，实际 ${g.stops[0].color}`);
  if (g.stops[1].color !== '0000FF') throw new Error(`应 0000FF，实际 ${g.stops[1].color}`);
});

// 12. 带空格 / 百分比带小数的写法
check('带空格与小数百分比', () => {
  const g = parseLinearGradient('linear-gradient(160deg, rgba(255, 255, 255, 0.16) 0.5%, rgba(0, 0, 0, 0.3) 99.5%)');
  if (!g) throw new Error('解析失败');
  if (g.stops.length !== 2) throw new Error(`应 2 停靠点，实际 ${g.stops.length}`);
  if (g.stops[0].pos !== 0.5) throw new Error(`首停靠点 pos 应 0.5，实际 ${g.stops[0].pos}`);
  if (g.stops[1].pos !== 99.5) throw new Error(`尾停靠点 pos 应 99.5，实际 ${g.stops[1].pos}`);
});

// 13. alpha 编码进标记（半透明端点跨 postprocess 传播）
check('alpha 编码进 gradientTag', () => {
  const g = parseLinearGradient('linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.30) 100%)');
  const tag = gradientTag(g.angle, g.stops);
  if (!tag.includes('@16')) throw new Error(`标记应含 @16，实际 ${tag}`);
  if (!tag.includes('@30')) throw new Error(`标记应含 @30，实际 ${tag}`);
  // 无 alpha 的渐变标记不应带 @
  const g2 = parseLinearGradient('linear-gradient(90deg, #FF0000 0%, #0000FF 100%)');
  const tag2 = gradientTag(g2.angle, g2.stops);
  if (tag2.includes('@')) throw new Error(`不透明渐变不应带 @，实际 ${tag2}`);
});

// 14. stopsFromTagColors 回解（postprocess 用）
check('stopsFromTagColors 回解含 alpha', () => {
  const stops = stopsFromTagColors('FFFFFF@84_000000@70');
  if (stops.length !== 2) throw new Error(`应 2 停靠点，实际 ${stops.length}`);
  if (stops[0].color !== 'FFFFFF' || Math.abs(stops[0].alpha - 0.84) > 0.01) throw new Error(`首停靠点错 ${JSON.stringify(stops[0])}`);
  if (stops[1].color !== '000000' || Math.abs(stops[1].alpha - 0.70) > 0.01) throw new Error(`尾停靠点错 ${JSON.stringify(stops[1])}`);
  if (stops[0].pos !== 0 || stops[1].pos !== 100) throw new Error('位置等分错误');
  // 不带 alpha 的
  const s2 = stopsFromTagColors('431407_F59E0B');
  if (s2[0].alpha !== undefined) throw new Error('无 @ 不应产生 alpha');
});

// 15. buildGradFillXml 输出 <a:alpha>（半透明端点）
check('gradFill 含 alpha 元素', () => {
  const g = parseLinearGradient('linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.30) 100%)');
  const xml = buildGradFillXml(g);
  if (!xml.includes('<a:alpha val=')) throw new Error('半透明渐变应输出 <a:alpha>');
  if (!xml.includes('val="16000"')) throw new Error('alpha 0.16 应为 16000（1/1000 %）');
  if (!xml.includes('val="30000"')) throw new Error('alpha 0.30 应为 30000');
  // 不透明渐变不应带 alpha
  const g2 = parseLinearGradient('linear-gradient(90deg, #FF0000 0%, #0000FF 100%)');
  const xml2 = buildGradFillXml(g2);
  if (xml2.includes('<a:alpha')) throw new Error('不透明渐变不应带 <a:alpha>');
});

// 16. postprocess 的 solidFill 正则兼容「带 alpha 子元素」形式
// 背景：渐变含 rgba 端点时，pptxgenjs 生成的 solidFill 会带 <a:alpha>，旧正则只认自闭合 → 静默失效
check('postprocess solidFill 正则兼容带 alpha 形式', () => {
  const RE = /<a:solidFill><a:srgbClr val="[^"]*"\s*(?:\/>|><a:alpha val="\d+"\/><\/a:srgbClr>)<\/a:solidFill>/;
  const selfClose = '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
  const withAlpha = '<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="16000"/></a:srgbClr></a:solidFill>';
  if (!RE.test(selfClose)) throw new Error('自闭合形式应匹配');
  if (!RE.test(withAlpha)) throw new Error('带 alpha 子元素形式应匹配（回归点）');
  if (RE.test('<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="16000"/></a:srgbClr><a:extra/></a:solidFill>')) {
    throw new Error('不应匹配多余子元素');
  }
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

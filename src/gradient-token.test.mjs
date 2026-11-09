// gradient.mjs 语义色 token 支持测试
import { parseLinearGradient, buildGradFillXml, gradientTag, firstStopColor } from './gradient.mjs';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`✓ ${name}`); }
  catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message}`); }
};
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} got=${JSON.stringify(a)} want=${JSON.stringify(b)}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg || 'assertion failed'); };

// 模拟 theme + resolveColor（与 theme.mjs 行为一致）
const theme = { colors: { primary: '#1E3A8A', accent: '#F59E0B', bg: '#FFFFFF', text: '#0F172A', muted: '#64748B', deep: '#0E3F8C' } };
const resolveColor = (v, th) => {
  if (!v) return null;
  const t2 = th || theme;
  if (v.startsWith('#') || v.startsWith('rgb')) return v;
  return t2.colors[v] || v;
};

// ── 解析 ──
t('语义 token 渐变解析（primary/accent）', () => {
  const g = parseLinearGradient('linear-gradient(135deg, primary 0%, accent 100%)');
  ok(g, 'should parse');
  eq(g.angle, 135, 'angle');
  eq(g.stops.length, 2, 'stops len');
  eq(g.stops[0].color, 'primary', 'stop0 color');
  eq(g.stops[0].token, true, 'stop0 token flag');
  eq(g.stops[0].pos, 0, 'stop0 pos');
  eq(g.stops[1].color, 'accent', 'stop1 color');
  eq(g.stops[1].pos, 100, 'stop1 pos');
});

t('语义 token 与 hex 混用', () => {
  const g = parseLinearGradient('linear-gradient(160deg, primary 0%, #C2410C 50%, accent 100%)');
  ok(g, 'should parse');
  eq(g.stops.length, 3, 'stops len');
  eq(g.stops[0].token, true, 'stop0 is token');
  ok(!g.stops[1].token, 'stop1 is hex (no token flag)');
  eq(g.stops[1].color, 'C2410C', 'stop1 hex uppercased');
  eq(g.stops[2].token, true, 'stop2 is token');
});

t('语义 token 无位置 → 自动等分', () => {
  const g = parseLinearGradient('linear-gradient(90deg, deep, primary, accent)');
  ok(g, 'should parse');
  eq(g.stops.map((s) => s.pos), [0, 50, 100], 'auto positions');
});

t('未知裸词不当颜色（to/red 之类）', () => {
  const g = parseLinearGradient('linear-gradient(90deg, to bottom, red 0%, primary 100%)');
  // "to bottom" 被跳过（'to' 非白名单）；"red" 非 hex 且非白名单也跳过
  // → 只剩 primary 一个停靠点 → 返回 null（渐变至少需 2 色）
  eq(g, null, '仅 1 个有效停靠点 → null');
  // 验证 "red" 确实没被当色值（若是，会得到 2 stops）
  const g2 = parseLinearGradient('linear-gradient(90deg, red 0%, blue 100%)');
  eq(g2, null, 'CSS 色名（red/blue）不支持，不应误认');
});

t('纯 hex 渐变仍正常（向后兼容）', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)');
  ok(g, 'should parse');
  eq(g.stops[0].color, '3B82F6', 'uppercase');
  ok(!g.stops[0].token, 'no token flag');
});

// ── XML 生成 ──
t('buildGradFillXml 解析 token（传 theme）', () => {
  const g = parseLinearGradient('linear-gradient(135deg, primary 0%, accent 100%)');
  const xml = buildGradFillXml(g, theme, resolveColor);
  ok(xml, 'should build');
  ok(xml.includes('1E3A8A'), 'primary resolved to #1E3A8A');
  ok(xml.includes('F59E0B'), 'accent resolved to #F59E0B');
  ok(xml.includes('<a:gs pos="0">'), 'pos 0');
  ok(xml.includes('<a:gs pos="100000">'), 'pos 100% = 100000');
});

t('buildGradFillXml 未传 theme 遇 token → 返回 null（调用方降级）', () => {
  const g = parseLinearGradient('linear-gradient(135deg, primary 0%, accent 100%)');
  const xml = buildGradFillXml(g);  // 不传 theme
  eq(xml, null, 'should return null');
});

t('buildGradFillXml 纯 hex 不传 theme 也能生成（向后兼容）', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)');
  const xml = buildGradFillXml(g);
  ok(xml, 'should build without theme');
  ok(xml.includes('3B82F6') && xml.includes('06B6D4'), 'colors present');
});

t('firstStopColor 解析 token', () => {
  const g = parseLinearGradient('linear-gradient(135deg, deep 0%, accent 100%)');
  eq(firstStopColor(g, theme, resolveColor), '0E3F8C', 'deep resolved');
});

t('firstStopColor 纯 hex', () => {
  const g = parseLinearGradient('linear-gradient(135deg, #9A3412 0%, #C2410C 100%)');
  eq(firstStopColor(g), '9A3412', 'hex as-is');
});

// ── tag ──
t('gradientTag 对 token 保持稳定命名', () => {
  const g1 = parseLinearGradient('linear-gradient(135deg, primary 0%, accent 100%)');
  const tag = gradientTag(g1.angle, g1.stops);
  ok(tag.includes('PRIMARY') && tag.includes('ACCENT'), 'tag uses token names: ' + tag);
});

console.log(`\n${pass} 通过, ${fail} 失败`);
if (fail) process.exit(1);

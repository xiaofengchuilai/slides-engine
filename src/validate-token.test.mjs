// validate 硬编码色告警测试
import { validateSlide } from './validate.mjs';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`✓ ${name}`); }
  catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message}`); }
};
const ok = (v, m) => { if (!v) throw new Error(m || 'assertion failed'); };

const hardcoded = (src) => {
  const r = validateSlide(src);
  return r.warnings.filter((w) => /硬编码色值/.test(w));
};

t('语义 token 页：零硬编码告警', () => {
  const src = `<Slide style={{ background: 'bg' }}>
    <Box style={{ background: 'primary', height: 100 }}>
      <Text style={{ color: 'textOnDark' }}>标题</Text>
    </Box>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length === 0, `不应告警，实际 ${w.length} 条: ${w.join(" | ")}`);
});

t('高饱和彩色 hex → 告警', () => {
  const src = `<Slide style={{ background: '#FAF7F2' }}>
    <Box style={{ background: '#C2410C', height: 100 }}>
      <Text style={{ color: '#1C1917' }}>文字</Text>
    </Box>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length >= 1, '应至少告警 1 条');
  ok(w.some((x) => x.includes('#C2410C')), '应告警主橙 #C2410C');
});

t('中性色不告警（纯白/纯黑/灰阶）', () => {
  const src = `<Slide style={{ background: '#FFFFFF' }}>
    <Box style={{ background: '#F5F5F5', height: 100 }}>
      <Text style={{ color: '#000000' }}>黑字</Text>
      <Text style={{ color: '#808080' }}>灰字</Text>
      <Text style={{ color: '#FFFFFF' }}>白字</Text>
    </Box>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length === 0, `中性色不应告警，实际 ${w.length} 条: ${w.join(" | ")}`);
});

t('语义色（涨跌红绿）不告警', () => {
  const src = `<Slide style={{ background: '#FFFFFF' }}>
    <Box style={{ height: 100 }}>
      <Text style={{ color: '#16A34A' }}>+12%（绿）</Text>
      <Text style={{ color: '#DC2626' }}>-8%（红）</Text>
    </Box>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length === 0, `语义色不应告警，实际 ${w.length} 条: ${w.join(" | ")}`);
});

t('渐变内硬编码 hex → 告警', () => {
  const src = `<Slide style={{ background: 'bg' }}>
    <Box style={{ background: 'linear-gradient(160deg, #9A3412 0%, #C2410C 100%)', height: 100 }} />
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length >= 1, '渐变内 hex 应告警');
});

t('渐变内语义 token → 不告警', () => {
  const src = `<Slide style={{ background: 'bg' }}>
    <Box style={{ background: 'linear-gradient(160deg, primary 0%, accent 100%)', height: 100 }} />
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length === 0, `token 渐变不应告警，实际 ${w.length} 条: ${w.join(" | ")}`);
});

t('同页同色只报一次（不刷屏）', () => {
  const src = `<Slide style={{ background: 'bg' }}>
    <Box style={{ background: '#C2410C', height: 50 }} />
    <Box style={{ background: '#C2410C', height: 50 }} />
    <Text style={{ color: '#C2410C' }}>三处</Text>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length === 1, `同色应只报 1 条，实际 ${w.length}`);
});

t('告警不阻断（无 error）', () => {
  const src = `<Slide style={{ background: '#FAF7F2' }}>
    <Box style={{ background: '#C2410C', height: 100 }}>
      <Text style={{ color: '#1C1917' }}>文字内容</Text>
    </Box>
  </Slide>`;
  const r = validateSlide(src);
  ok(r.success !== false, '硬编码色不应导致 validate 失败（仅 warning）');
});

t('真实工程场景：橙系配色应被识别为硬编码', () => {
  // 模拟真实封面片段（深色块内白字 + 浅底根容器）
  const src = `<Slide style={{ background: '#FAF7F2' }}>
    <Box style={{ background: 'linear-gradient(160deg, #9A3412 0%, #C2410C 55%, #7C2D12 100%)', width: 540, height: 720 }}>
      <Text style={{ color: '#FFEDD5', fontSize: 20 }}>新员工培训</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 62 }}>结构化表达</Text>
    </Box>
  </Slide>`;
  const w = hardcoded(src);
  ok(w.length >= 2, `应识别出多个硬编码色（含渐变内），实际 ${w.length}: ${w.join(" | ")}`);
  console.log("     → 检出: " + w.map((x) => (x.match(/#[0-9A-F]{6}/) || [])[0]).join(", "));
});

console.log(`\n${pass} 通过, ${fail} 失败`);
if (fail) process.exit(1);

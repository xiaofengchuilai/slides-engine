// validate.mjs 测试：校验器能抓到语法/资源/溢出违规
import { validateSlide } from './validate.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`✓ ${name}`); }
  catch (e) { failed++; console.log(`✗ ${name} → ${e.message}`); }
}

// 1. 合法页面通过
check('合法页面无错误', () => {
  const src = `<Slide><Box style={{ padding: 48 }}><Text style={{ fontSize: 18 }}>你好</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.length}: ${errors.join('; ')}`);
});

// 2. 编造图标名被拦截
check('编造图标名被拦截', () => {
  const src = `<Slide><FAIcon name="no-such-icon-xyz" /></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('图标名'))) throw new Error(`应报图标名错误，实际 ${JSON.stringify(errors)}`);
});

// 3. image:// 占位符被拦截
check('image:// 占位符被拦截', () => {
  const src = `<Slide><Image src="image://x" /></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('占位符'))) throw new Error(`应报占位符错误，实际 ${JSON.stringify(errors)}`);
});

// 4. import 语句被拦截
check('import 语句被拦截', () => {
  const src = `import x from 'y';\n<Slide><Box /></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('模块语句'))) throw new Error(`应报模块语句错误，实际 ${JSON.stringify(errors)}`);
});

// 5. 溢出画布被拦截
check('溢出画布被拦截', () => {
  const src = `<Slide><Box style={{ position: 'absolute', left: 0, top: 0, width: 2000, height: 2000 }} /></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('溢出画布'))) throw new Error(`应报溢出错误，实际 ${JSON.stringify(errors)}`);
});

// 6. flex 坍缩（P12 类：center 列内 flex row 无宽）被拦截
check('容器坍缩被拦截', () => {
  const src = `<Slide><Box style={{ flexDirection: 'column', alignItems: 'center', padding: 50 }}><Box style={{ flexDirection: 'row' }}><Box style={{ flex: 1, background: '#EEE', padding: 16 }}><Text style={{ fontSize: 18 }}>卡一内容很长很长</Text></Box><Box style={{ flex: 1, background: '#EEE', padding: 16 }}><Text style={{ fontSize: 18 }}>卡二内容很长</Text></Box></Box></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('坍缩'))) throw new Error(`应报坍缩错误，实际 ${JSON.stringify(errors)}`);
});

// 7. 正常页面不误报坍缩/重叠（圆形编号徽章等窄元素不算）
check('正常页面无坍缩误报', () => {
  const src = `<Slide><Box style={{ padding: 48, flexDirection: 'column', alignItems: 'center' }}><Box style={{ width: 36, height: 36, borderRadius: 18, background: '#C42819', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: '#FFFFFF' }}>1</Text></Box><Text style={{ fontSize: 18, marginTop: 12 }}>正文内容正常排布不会误报</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.length}: ${errors.join('; ')}`);
});

// 8. SVG 圆球超出 viewBox 高被裁切被拦截（P6 底部圆被裁教训）
check('SVG 圆球超 viewBox 被裁切拦截', () => {
  const src = `<Slide><svg width={100} height={100} viewBox="0 0 100 100"><circle cx="50" cy="90" r="20" /></svg></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('裁切'))) throw new Error(`应报裁切错误，实际 ${JSON.stringify(errors)}`);
});

// 9. SVG 元素都在 viewBox 内不误报
check('SVG 正常不误报裁切', () => {
  const src = `<Slide><svg width={100} height={120} viewBox="0 0 100 120"><circle cx="50" cy="90" r="20" /></svg></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.length}: ${errors.join('; ')}`);
});

// 10. SVG 圆球贴 viewBox 左边界（P10 左截：cx-r=0）被拦截
check('SVG 圆球贴左边被拦截', () => {
  const src = `<Slide><svg width={100} height={100} viewBox="0 0 100 100"><circle cx="26" cy="50" r="26" /></svg></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('裁切'))) throw new Error(`应报贴边错误，实际 ${JSON.stringify(errors)}`);
});

// 11. 满幅装饰大圆环贴边不误报（封面背景环）
check('SVG 装饰大圆环贴边不误报', () => {
  const src = `<Slide><svg width={300} height={300} viewBox="0 0 300 300"><circle cx="150" cy="150" r="148" fill="none" stroke="#CCC" /></svg></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.length}: ${errors.join('; ')}`);
});

// 12. 可读性对比度：浅底浅色小字被拦截（2026-09-08 引擎对比度硬校验）
check('浅底浅字（小字正文）被拦截', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'#FFFFFF' }}><Text style={{ fontSize:16, color:'#F5F7FA' }}>看不清</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (!errors.some((e) => e.includes('对比度'))) throw new Error(`应报对比度错误，实际 ${JSON.stringify(errors)}`);
});

// 13. 深底白字 / 白底深字 正常配色通过（不误报）
check('深底白字正常配色通过', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'#0F172A' }}><Text style={{ fontSize:16, color:'#FFFFFF' }}>清晰</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.join('; ')}`);
});
check('白底深字正常配色通过', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'#FFFFFF' }}><Text style={{ fontSize:16, color:'#0F172A' }}>清晰</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.join('; ')}`);
});

// 14. 语义 token（text 深字白底）通过；accent 大字不阻断
check('语义 token 配色通过', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'bg' }}><Text style={{ fontSize:16, color:'text' }}>正文</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.join('; ')}`);
});
check('accent 大数字不阻断（warning 提示不 error）', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'#FFFFFF' }}><Text style={{ fontSize:96, color:'accent', bold:true }}>80%</Text></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.join('; ')}`);
});
check('深蓝渐变背景内白字通过（渐变取首色判深底）', () => {
  const src = `<Slide><Box style={{ height:720, width:1280, background:'#FFFFFF' }}><Box style={{ width:500, background:'linear-gradient(180deg, #1E3A8A 0%, #0F172A 100%)', padding:40 }}><Text style={{ fontSize:20, color:'#FFFFFF' }}>深底白字</Text></Box></Box></Slide>`;
  const { errors } = validateSlide(src, { file: 't.slide' });
  if (errors.length !== 0) throw new Error(`应 0 错误，实际 ${errors.join('; ')}`);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);

// 组件库：预设的常用组件（封面/目录/KPI卡/页脚等）
// 组件 = 返回 JSX 的函数。JSX 源码需先经 SWC 编译成 React.createElement 调用，
// 再注入 runtime（因为 runtime 里没有 JSX 编译器）。
import { transformSync } from '@swc/core';

// 原始 JSX 组件源码
const componentSources = {
  KpiCard: `
function KpiCard({ number, label, desc }) {
  return (
    <Box style={{ flex: 1, background: 'primary', borderRadius: 12, padding: 24, flexDirection: 'column', gap: 8 }}>
      <Text style={{ fontSize: 48, color: '#FFFFFF', bold: true }}>{number}</Text>
      <Text style={{ fontSize: 18, color: '#FFFFFF', bold: true }}>{label}</Text>
      <Text style={{ fontSize: 14, color: '#FFFFFF' }}>{desc}</Text>
    </Box>
  );
}`,

  Cover: `
function Cover({ title, subtitle, author }) {
  return (
    <Box style={{ padding: 80, flexDirection: 'column', justifyContent: 'center', gap: 24, height: '100%' }}>
      <Box style={{ width: 80, height: 6, background: 'accent', borderRadius: 3 }} />
      <Text style={{ fontSize: 56, color: 'primary', bold: true }}>{title}</Text>
      <Text style={{ fontSize: 24, color: 'muted' }}>{subtitle}</Text>
      <Text style={{ fontSize: 16, color: 'muted' }}>{author}</Text>
    </Box>
  );
}`,

  TOC: `
function TOC({ items }) {
  const list = items || [];
  return (
    <Box style={{ padding: 60, flexDirection: 'column', gap: 20 }}>
      <Text style={{ fontSize: 36, color: 'primary', bold: true }}>目录</Text>
      {list.map(function(item, i) {
        return (
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 24, color: 'accent', bold: true }}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={{ fontSize: 22 }}>{item}</Text>
          </Box>
        );
      })}
    </Box>
  );
}`,

  Footer: `
function Footer({ page, total, label }) {
  return (
    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
      <Text style={{ fontSize: 12, color: 'muted' }}>{label || ''}</Text>
      <Text style={{ fontSize: 12, color: 'muted' }}>{page} / {total}</Text>
    </Box>
  );
}`,
};

// 把每个 JSX 组件源码编译成 JS（React.createElement 调用）
function compileComponent(jsxSource) {
  return transformSync(jsxSource, {
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2022' },
    module: { type: 'commonjs' },
  }).code;
}

// 缓存编译结果（组件源码固定，只需编译一次）
let _cachedRuntime = null;

// 生成组件库的 RUNTIME_PRE 代码片段（已编译为纯 JS，结果缓存）
export function buildComponentsRuntime() {
  if (_cachedRuntime === null) {
    _cachedRuntime = Object.values(componentSources).map(compileComponent).join('\n') + '\n';
  }
  return _cachedRuntime;
}

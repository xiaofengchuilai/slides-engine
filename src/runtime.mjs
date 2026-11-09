// 运行时：组件注册表 + vm 沙箱执行（AST 版，可靠提取根组件）
import vm from 'node:vm';
import { transformSync, parseSync } from '@swc/core';
import { buildComponentsRuntime } from './components.mjs';

const RUNTIME_PRE = `
const React = {
  Fragment: '__Fragment__',
  createElement: function(type, props, ...children) {
    if (typeof type === 'function') { return type({ ...(props||{}), children: children.flat(Infinity) }); }
    // Fragment：不产生节点，children 直接平铺返回（.map() 里用 <>...</> 时透明）
    if (type === '__Fragment__') { return children.flat(Infinity); }
    return { type: typeof type==='string'?type:type.name, props: props||{}, children: children.flat(Infinity) };
  }
};
function makeNode(t){return function(p){const pr={...(p||{})};const ch=pr.children||[];delete pr.children;return {type:t,props:pr,children:ch}}}
const Slide=makeNode('Slide');const Box=makeNode('Box');const Text=makeNode('Text');const Image=makeNode('Image');const FAIcon=makeNode('FAIcon');const Table=makeNode('Table');const Chart=makeNode('Chart');const Shape=makeNode('Shape');const QRCode=makeNode('QRCode');const Math=makeNode('Math');const CodeBlock=makeNode('CodeBlock');const RoughBox=makeNode('RoughBox');const Emoji=makeNode('Emoji');
${buildComponentsRuntime()}
`;

export function compileSlide(source, filename = 'slide.jsx') {
  return transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2022' },
    module: { type: 'commonjs' },
  }).code;
}

// 用 SWC AST 找最后一个 ExpressionStatement 的 span（UTF-16 偏移）
// 同时校验它确实是 JSX（否则报错，避免把普通表达式误当根组件）
function findRootSpan(source) {
  const ast = parseSync(source, { syntax: 'ecmascript', jsx: true });
  let lastExpr = null;
  for (const stmt of ast.body) {
    if (stmt.type === 'ExpressionStatement') lastExpr = stmt;
  }
  if (!lastExpr) return null;

  // 校验最后一个表达式是 JSX 元素（<Slide> / <自定义组件> / <>fragment</>）
  const expr = lastExpr.expression;
  const isJsx = expr && (expr.type === 'JSXElement' || expr.type === 'JSXFragment');
  if (!isJsx) {
    throw new Error('最后一个表达式必须是 JSX（<Slide>...</Slide>），不能是普通语句');
  }
  return lastExpr.span;
}

export function executeSlide(source, { timeout = 5000 } = {}) {
  const rootSpan = findRootSpan(source);
  if (!rootSpan) throw new Error('未找到顶层 <Slide> 表达式');

  // SWC 的 JSX ExpressionStatement span 不含开头的 '<'（start 指向 '<' 之后）。
  // 向前扫描到最近的 '<'（跳过空白/换行；注释场景下 '<' 不在 start-1 位）。
  let start = rootSpan.start;
  while (start > 0 && source[start - 1] !== '<' && !/[\s]/.test(source[start - 1])) {
    start--;
  }
  if (source[start - 1] === '<') start--;

  // 根表达式源码（UTF-16 切片）
  const rootExprSource = source.slice(start, rootSpan.end);

  // 干净方案：编译前把根表达式原地替换成 __RESULT__ = (...) 赋值，
  // 整个 source 只编译一次、只执行一次，不用二次切片、二次执行。
  // 注意：')' 后补分号，确保与后续语句分隔（否则 "根后还有语句" 场景会拼成 )const）
  const modifiedSource =
    source.slice(0, start) +
    '__RESULT__ = (' + rootExprSource + ');' +
    source.slice(rootSpan.end);

  const compiled = compileSlide(modifiedSource);
  const wrapped = 'var __RESULT__;\n' + RUNTIME_PRE + compiled;

  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(wrapped, { filename: 'slide.js' }).runInContext(sandbox, { timeout });
  return sandbox.__RESULT__;
}

export function dumpTree(node, indent = 0) {
  const pad = '  '.repeat(indent);
  const children = node.children || [];
  const text = children.find((c) => typeof c === 'string');
  const lines = [`${pad}${node.type} ${JSON.stringify(node.props)}${text !== undefined ? ' → "' + text + '"' : ''}`];
  for (const c of children) {
    if (typeof c === 'string') continue;
    lines.push(dumpTree(c, indent + 1));
  }
  return lines.join('\n');
}

// codeblock.mjs 测试：codeToPng 返回 PNG buffer
import { codeToPng } from './codeblock.mjs';

let passed = 0, failed = 0;
function check(name, fn) {
  fn().then(() => { passed++; console.log(`✓ ${name}`); })
    .catch((e) => { failed++; console.log(`✗ ${name} → ${e.message}`); });
}

async function run() {
  check('JS 代码高亮返回 PNG buffer', async () => {
    const buf = await codeToPng('const a = 1;', { lang: 'javascript', theme: 'github-dark' });
    if (!buf || buf.length < 100) throw new Error('应返回非空 PNG buffer');
    // PNG 魔数
    if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('不是 PNG 格式');
  });

  check('Python 代码（light 主题）', async () => {
    const buf = await codeToPng('print("hi")', { lang: 'python', theme: 'github-light' });
    if (!buf || buf.length < 100) throw new Error('应返回非空 PNG');
  });

  check('空代码返回 null', async () => {
    const buf = await codeToPng('', { lang: 'javascript' });
    if (buf !== null) throw new Error('空代码应返回 null');
  });

  // 等待所有异步 check 完成
  await new Promise((r) => setTimeout(r, 100));
  console.log(`\n${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}
run();

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 引擎根 = 本脚本所在目录的上一级（scripts/ → engine root），不依赖任何绝对路径
const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_DIR = path.join(ENGINE, 'golden');
fs.mkdirSync(GOLDEN_DIR, { recursive: true });

// 风格 → 主题映射（与 qa-all.mjs 一致）：深色/特殊风格用对应主题，避免语义色取错
function themeForStyle(style) {
  const map = { tech: 'tech', 'black-gold': 'redgold', chinese: 'culture', literary: 'culture', educational: 'academic' };
  return map[style] || 'business';
}

// 人工验证过的代表性模板（用户确认「完美」的）
// [模板相对路径, 描述]
const samples = [
  ['content/cartoon/1521.slide', '1521_四宫格'],
  ['content/black-gold/1571.slide', '1571_黑金右栏'],
  ['ending/business/1051.slide', '1051_结尾装饰'],
  ['cover/hand-drawn/016.slide', '016_手绘封面'],
  ['cover/hand-drawn/017.slide', '017_手绘多框'],
  // 2026-09-02 新增（用户已确认 OK）
  ['cover/hand-drawn/020.slide', '020_手绘封面2'],
  ['content/cartoon/1523.slide', '1523_卡通对比'],
  ['content/business/1538.slide', '1538_竞争对比'],
  ['content/literary/1551.slide', '1551_文学双栏'],
  ['content/tech/1581.slide', '1581_科技主题'],
  ['content/educational/1667.slide', '1667_认识时钟'],
  // 2026-09-02 抽查确认 OK（第二批）
  ['cover/chinese/140.slide', '140_国风封面'],
  ['cover/flat/152.slide', '152_扁平封面'],
  ['cover/geometric/149.slide', '149_几何封面'],
  ['cover/cartoon/107.slide', '107_卡通封面'],
  ['cover/minimalist/087.slide', '087_极简封面'],
  ['cover/tech/036.slide', '036_科技封面'],
  ['cover/black-gold/031.slide', '031_黑金封面'],
  ['content/minimalist/1501.slide', '1501_极简内容'],
  ['content/educational/1641.slide', '1641_教育内容'],
  ['toc/tech/3575.slide', '3575_科技目录'],
  ['transition/black-gold/515.slide', '515_黑金转场'],
  ['ending/cartoon/1005.slide', '1005_卡通结尾'],
  ['title/literary/3016.slide', '3016_文艺标题'],
  ['decorative/tech/2025.slide', '2025_科技装饰'],
  ['functional/geometric/2509.slide', '2509_几何功能'],
  ['content/chinese/1621.slide', '1621_国风三图'],
  // 2026-09-02 抽查修复确认 OK（3503 居中 / 1525 去水印 / 1595 注同行）
  ['toc/chinese/3503.slide', '3503_国风目录'],
  ['content/cartoon/1525.slide', '1525_卡通养成'],
  ['content/minimalist/1595.slide', '1595_极简左图文'],
  // 2026-09-02 0 尺寸/flex 折行修复确认 OK
  ['content/tech/1687.slide', '1687_服务支持'],
  // 2026-09-02 第四批抽查确认 OK（45 个）+ 3501 修复版
  ['content/argument.slide', 'ARG_论点通用'],
  ['content/data.slide', 'DAT_数据通用'],
  ['content/process.slide', 'PRO_流程通用'],
  ['content/case.slide', 'CAS_案例通用'],
  ['content/comparison.slide', 'COM_对比通用'],
  ['content/concept.slide', 'CON_概念通用'],
  ['content/problem.slide', 'PRB_问题通用'],
  ['content/trend.slide', 'TRD_趋势通用'],
  ['content/summary.slide', 'SUM_总结通用'],
  ['cover/minimalist/001.slide', '001_极简封面'],
  ['cover/minimalist/092.slide', '092_极简封面2'],
  ['cover/flat/026.slide', '026_扁平封面'],
  ['cover/flat/076.slide', '076_扁平封面2'],
  ['cover/cartoon/011.slide', '011_卡通封面'],
  ['cover/cartoon/145.slide', '145_卡通封面2'],
  ['cover/tech/046.slide', '046_科技封面'],
  ['cover/black-gold/078.slide', '078_黑金封面'],
  ['cover/hand-drawn/018.slide', '018_手绘封面'],
  ['cover/geometric/150.slide', '150_几何封面'],
  ['cover/literary/022.slide', '022_文艺封面'],
  ['cover/chinese/006.slide', '006_国风封面'],
  ['content/black-gold/1572.slide', '1572_黑金内容'],
  ['content/black-gold/1580.slide', '1580_黑金内容2'],
  ['content/literary/1552.slide', '1552_文学内容'],
  ['content/geometric/1542.slide', '1542_几何内容'],
  ['content/educational/1642.slide', '1642_教育内容'],
  ['content/chinese/1633.slide', '1633_国风内容'],
  ['content/tech/1673.slide', '1673_科技内容'],
  ['content/minimalist/1502.slide', '1502_极简内容'],
  ['content/business/1531.slide', '1531_商务内容'],
  ['content/cartoon/1522.slide', '1522_卡通内容'],
  ['ending/tech/1099.slide', '1099_科技结尾'],
  ['ending/black-gold/1015.slide', '1015_黑金结尾'],
  ['ending/cartoon/1039.slide', '1039_卡通结尾'],
  ['ending/flat/1013.slide', '1013_扁平结尾'],
  ['ending/literary/1011.slide', '1011_文艺结尾'],
  ['title/cartoon/3007.slide', '3007_卡通标题'],
  ['title/chinese/3004.slide', '3004_国风标题'],
  ['title/black-gold/3022.slide', '3022_黑金标题'],
  ['transition/cartoon/505.slide', '505_卡通转场'],
  ['transition/chinese/503.slide', '503_国风转场'],
  ['decorative/hand-drawn/2010.slide', '2010_手绘装饰'],
  ['functional/cartoon/2505.slide', '2505_卡通功能'],
  ['functional/flat/2513.slide', '2513_扁平功能'],
  ['toc/minimalist/3501.slide', '3501_极简目录'],
  ['toc/tech/3517.slide', '3517_科技目录'],
  // 2026-09-02 第五批抽查确认 OK（54 个）+ 1532 修复版（lineHeight 单行垂直偏移引擎修复）
  ['content/black-gold/1573.slide', '1573_黑金内容'],
  ['content/black-gold/1576.slide', '1576_黑金内容2'],
  ['content/black-gold/1579.slide', '1579_黑金内容3'],
  ['content/business/1532.slide', '1532_战略规划'],
  ['content/business/1536.slide', '1536_商务内容'],
  ['content/business/1540.slide', '1540_商务内容2'],
  ['content/cartoon/1524.slide', '1524_卡通内容'],
  ['content/cartoon/1527.slide', '1527_卡通内容2'],
  ['content/cartoon/1530.slide', '1530_卡通内容3'],
  ['content/flat/1562.slide', '1562_扁平内容'],
  ['content/flat/1566.slide', '1566_扁平内容2'],
  ['content/flat/1570.slide', '1570_扁平内容3'],
  ['content/geometric/1543.slide', '1543_几何内容'],
  ['content/geometric/1547.slide', '1547_几何内容2'],
  ['content/literary/1553.slide', '1553_文学内容'],
  ['content/literary/1557.slide', '1557_文学内容2'],
  ['content/tech/1584.slide', '1584_科技内容'],
  ['content/tech/1676.slide', '1676_科技内容2'],
  ['content/tech/1690.slide', '1690_科技内容3'],
  ['content/chinese/1634.slide', '1634_国风内容'],
  ['content/chinese/1638.slide', '1638_国风内容2'],
  ['content/educational/1645.slide', '1645_教育内容'],
  ['content/educational/1656.slide', '1656_教育内容2'],
  ['content/educational/1670.slide', '1670_教育内容3'],
  ['content/minimalist/1505.slide', '1505_极简内容'],
  ['content/minimalist/1604.slide', '1604_极简内容2'],
  ['cover/minimalist/002.slide', '002_极简封面'],
  ['cover/minimalist/090.slide', '090_极简封面2'],
  ['cover/minimalist/137.slide', '137_极简封面3'],
  ['cover/cartoon/012.slide', '012_卡通封面'],
  ['cover/cartoon/108.slide', '108_卡通封面2'],
  ['cover/flat/027.slide', '027_扁平封面'],
  ['cover/flat/067.slide', '067_扁平封面2'],
  ['cover/tech/037.slide', '037_科技封面'],
  ['cover/tech/050.slide', '050_科技封面2'],
  ['cover/black-gold/032.slide', '032_黑金封面'],
  ['cover/black-gold/082.slide', '082_黑金封面2'],
  ['cover/chinese/007.slide', '007_国风封面'],
  ['cover/chinese/141.slide', '141_国风封面2'],
  ['cover/literary/023.slide', '023_文艺封面'],
  ['cover/hand-drawn/146.slide', '146_手绘封面'],
  ['cover/geometric/151.slide', '151_几何封面'],
  ['cover/business/042.slide', '042_商务封面'],
  ['cover/business/057.slide', '057_商务封面2'],
  ['ending/tech/1017.slide', '1017_科技结尾'],
  ['ending/black-gold/1090.slide', '1090_黑金结尾'],
  ['ending/cartoon/1040.slide', '1040_卡通结尾'],
  ['ending/chinese/1030.slide', '1030_国风结尾'],
  ['ending/geometric/1059.slide', '1059_几何结尾'],
  ['ending/minimalist/1020.slide', '1020_极简结尾'],
  ['toc/cartoon/3535.slide', '3535_卡通目录'],
  ['toc/flat/3567.slide', '3567_扁平目录'],
  ['toc/business/3544.slide', '3544_商务目录'],
  ['transition/black-gold/554.slide', '554_黑金转场'],
  ['transition/cartoon/529.slide', '529_卡通转场'],
];

const manifest = [];
console.log('生成黄金样本…');
for (const [rel, name] of samples) {
  const src = path.join(ENGINE, 'references/templates', rel);
  const style = rel.split('/')[1]; // <type>/<style>/xxx.slide
  const theme = themeForStyle(style);
  const out = path.join(GOLDEN_DIR, `${name}.pptx`);
  try {
    execSync(`node "${path.join(ENGINE, 'src/cli.mjs')}" "${src}" --out "${out}" --theme ${theme}`, {
      stdio: 'pipe', encoding: 'utf8', timeout: 60000,
    });
    console.log(`✓ ${name} (theme=${theme})`);
    manifest.push({ name, source: rel, golden: `${name}.pptx`, theme });
  } catch (e) {
    console.log(`✗ ${name} 失败: ${String(e.stdout || e.message).slice(0, 100)}`);
  }
}
// 写 manifest.json
fs.writeFileSync(path.join(GOLDEN_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n黄金样本库完成：${manifest.length} 个，manifest.json 已写`);

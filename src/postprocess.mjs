// 后处理：把 pptx 里文本 shape 规范化为统一格式，保证各预览器渲染一致
// 关键：每条正则都带失效哨兵——匹配 0 次时告警（说明 pptxgenjs 输出格式变了，补丁静默失效）
import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildGradFillXml, stopsFromTagColors } from './gradient.mjs';

// 记录每条正则的匹配统计，供告警与测试使用
let patchStats = [];

// 执行一次替换并记录匹配数
// optional=true 表示"条件性补丁"——只有特定内容才触发，匹配0是正常的（不告警）
function applyPatch(xml, label, pattern, replacement, optional = false) {
  const matches = xml.match(new RegExp(pattern.source, 'g')) || [];
  const count = matches.length;
  if (count > 0) {
    xml = xml.replace(new RegExp(pattern.source, 'g'), replacement);
  }
  patchStats.push({ label, count, optional });
  return xml;
}

// 重置统计（每次 postProcess 前调用）
function resetStats() {
  patchStats = [];
}

// 报告统计：只对"必匹配且匹配0"的核心补丁告警（optional 条件性补丁匹配0是正常的）
function reportStats() {
  const zeroMatches = patchStats.filter((s) => s.count === 0 && !s.optional);
  for (const s of zeroMatches) {
    console.warn(`⚠ [postprocess] 核心补丁失效（匹配0次）: ${s.label}`);
  }
  return { all: patchStats, zeroMatches };
}

// 渐变后处理：匹配 name="GRAD_角度_色1_色2" 的 shape，把 solidFill 替换成 gradFill
// 【2026-09-11】标记格式扩展：色值可带 @透明度百分（如 FFFFFF@84）——正则需允许 '@' 与数字。
function applyGradients(xml) {
  const re = /<p:sp><p:nvSpPr><p:cNvPr id="(\d+)" name="GRAD_([\d.]+)_([0-9A-Fa-f_@]+)">.*?<\/p:sp>/g;
  let changed = false;
  xml = xml.replace(re, (whole, id, angleStr, colorsStr) => {
    const angle = parseFloat(angleStr);
    const stops = stopsFromTagColors(colorsStr);
    const gradFill = buildGradFillXml({ angle, stops });
    // 把整块里的 solidFill 替换成 gradFill。
    // 【2026-09-11】兼容两种形式：自闭合 `<a:srgbClr val="X"/>` 与
    //   带透明度子元素的 `<a:srgbClr val="X"><a:alpha val="N"/></a:srgbClr>`。
    //   后者发生在「渐变含 rgba 端点」时：我们把 transparency 传给 pptxgenjs，它生成 solidFill 时就写了 alpha，
    //   旧正则只认自闭合 → 不匹配 → 渐变静默失效（实测末页渐变未生效的直接原因）。
    const replaced = whole.replace(
      /<a:solidFill><a:srgbClr val="[^"]*"\s*(?:\/>|><a:alpha val="\d+"\/><\/a:srgbClr>)<\/a:solidFill>/,
      gradFill
    );
    changed = true;
    return replaced;
  });
  if (changed) {
    patchStats.push({ label: '渐变 gradFill 替换', count: 1, optional: true });
  }
  return xml;
}

// 文字渐变后处理：匹配 name="TXTGRAD_角度_色1_色2" 的文本 shape，把 rPr 里的 solidFill 替换成 gradFill
function applyTextGradients(xml) {
  const re = /<p:sp><p:nvSpPr><p:cNvPr id="(\d+)" name="TXTGRAD_([\d.]+)_([0-9A-Fa-f_@]+)">[\s\S]*?<\/p:sp>/g;
  let count = 0;
  xml = xml.replace(re, (whole, id, angleStr, colorsStr) => {
    const angle = parseFloat(angleStr);
    const stops = stopsFromTagColors(colorsStr);
    const gradFill = buildGradFillXml({ angle, stops });
    // 替换该 sp 内所有 rPr 里的 solidFill（文本 run 的颜色）。同样兼容带 alpha 的形式。
    const replaced = whole.replace(
      /<a:rPr([^>]*)><a:solidFill><a:srgbClr val="[^"]*"\s*(?:\/>|><a:alpha val="\d+"\/><\/a:srgbClr>)<\/a:solidFill>/g,
      '<a:rPr$1>' + gradFill
    );
    count++;
    return replaced;
  });
  if (count > 0) {
    patchStats.push({ label: '文字渐变 gradFill 替换', count, optional: true });
  }
  return xml;
}

export async function postProcessTxBox(pptxPath) {
  resetStats();
  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);

  const slideFiles = Object.keys(zip.files).filter(
    (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)
  );

  for (const f of slideFiles) {
    let xml = await zip.file(f).async('string');

    // 0. 渐变后处理：GRAD_ 标记 shape 的 solidFill → gradFill
    xml = applyGradients(xml);
    xml = applyTextGradients(xml);

    // 1. 给文本 shape 加 txBox（<p:cNvSpPr/> 或 <p:cNvSpPr></p:cNvSpPr> → txBox="1"）
    // txBox 自闭合是"必匹配"（任何文本 shape 都有）
    xml = applyPatch(xml, 'txBox 自闭合', /<p:cNvSpPr\/>/g, '<p:cNvSpPr txBox="1"/>');
    xml = applyPatch(xml, 'txBox 成对标签', /<p:cNvSpPr><\/p:cNvSpPr>/g, '<p:cNvSpPr txBox="1"></p:cNvSpPr>', true);

    // 2. 给 cNvPr 加 descr（isTemplate:text），并清空 name（条件性：只有文本 shape）
    xml = applyPatch(
      xml,
      'cNvPr descr 标记',
      /<p:cNvPr id="(\d+)" name="Text \d+"><\/p:cNvPr>/g,
      '<p:cNvPr id="$1" name="" descr="{&quot;isTemplate&quot;:true,&quot;type&quot;:&quot;text&quot;}"></p:cNvPr>',
      true
    );

    // 3. xfrm 加 rot/flipH/flipV（条件性）
    xml = applyPatch(xml, 'xfrm 旋转标记', /<a:xfrm><a:off/g, '<a:xfrm rot="0" flipH="0" flipV="0"><a:off', true);

    // 4. 去掉 prstGeom 里的空 avLst（条件性）
    xml = applyPatch(xml, '去空 avLst', /<a:prstGeom prst="rect"><a:avLst><\/a:avLst><\/a:prstGeom>/g, '<a:prstGeom prst="rect"></a:prstGeom>', true);

    // 5. 去掉 noFill 和空 ln（条件性）
    xml = applyPatch(xml, '去 noFill+ln 成对', /<a:noFill\/><a:ln><\/a:ln>/g, '', true);
    xml = applyPatch(xml, '去 noFill+ln 自闭合', /<a:noFill\/><a:ln\/>/g, '', true);

    // 6. bodyPr 去掉 rtlCol 和 anchor（条件性）
    xml = applyPatch(xml, '去 rtlCol/anchor', / rtlCol="0" anchor="t"/g, '', true);

    // 7. 去掉 lstStyle（条件性）
    xml = applyPatch(xml, '去 lstStyle', /<a:lstStyle\/>/g, '', true);

    // 8. pPr 去掉 indent/marL/buNone（条件性）
    xml = applyPatch(xml, 'pPr 去 indent/marL', /<a:pPr indent="0" marL="0">/g, '<a:pPr>', true);
    xml = applyPatch(xml, 'pPr 去 buNone', /<a:buNone\/>/g, '', true);

    // 9. rPr 去掉 dirty/pitchFamily/charset/cs（条件性，保留 b="1" 加粗）
    xml = applyPatch(xml, '去 dirty', / dirty="0"/g, '', true);
    xml = applyPatch(xml, '去 pitchFamily', / pitchFamily="\d+"/g, '', true);
    xml = applyPatch(xml, '去 charset', / charset="[-\d]+"/g, '', true);
    xml = applyPatch(xml, '去 cs 字体', /<a:cs typeface="[^"]*"\/>/g, '', true);

    // 10. endParaRPr 简化（条件性）
    xml = applyPatch(xml, 'endParaRPr 自闭合', /<a:endParaRPr[^>]*\/>/g, '<a:endParaRPr/>', true);
    xml = applyPatch(xml, 'endParaRPr 成对', /<a:endParaRPr[^>]*><\/a:endParaRPr>/g, '<a:endParaRPr/>', true);

    // 11. 去掉 slide 末尾的 clrMapOvr（条件性）
    xml = applyPatch(xml, '去 clrMapOvr 成对', /<p:clrMapOvr><a:masterClrMapping\/><\/p:clrMapOvr>/g, '', true);
    xml = applyPatch(xml, '去 clrMapOvr 自闭合', /<p:clrMapOvr\/>/g, '', true);

    zip.file(f, xml);
  }

  // 12. 图表 numFmt 修复：类别轴 sourceLinked="1" → "0"
  const chartFiles = Object.keys(zip.files).filter(
    (f) => /^ppt\/charts\/chart\d+\.xml$/.test(f)
  );
  for (const f of chartFiles) {
    let xml = await zip.file(f).async('string');
    xml = applyPatch(xml, '图表 numFmt sourceLinked', /formatCode="General" sourceLinked="1"/g, 'formatCode="General" sourceLinked="0"');
    zip.file(f, xml);
  }

  const out = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(pptxPath, out);
  reportStats();
  return pptxPath;
}

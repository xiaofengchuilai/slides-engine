// Chart 图表：组件 props → pptxgenjs addChart 的映射与数据转换
// chartType 小驼峰 → pptx.ChartType；data 二维数组 → [{name, labels, values}]

// chartType 映射：组件入参（小驼峰）→ pptxgenjs ChartType 键
const CHART_TYPE_MAP = {
  barChart: 'bar',
  bar3dChart: 'bar3D',
  lineChart: 'line',
  areaChart: 'area',
  pieChart: 'pie',
  doughnutChart: 'doughnut',
  radarChart: 'radar',
  scatterChart: 'scatter',
  bubbleChart: 'bubble',
};

export function mapChartType(chartType) {
  return CHART_TYPE_MAP[chartType] || null;
}

// data 转换：二维数组 → pptxgenjs [{name, labels, values}]
// 入参格式: [['类别','系列1','系列2'], ['分类1', 10, 20], ...]
// pptxgenjs: [{ name:'系列1', labels:['分类1',...], values:[10,...] }, ...]
export function convertChartData(data) {
  if (!Array.isArray(data) || data.length < 2) return [];

  const header = data[0];
  const seriesNames = header.slice(1); // 去掉第一列（类别名）
  const rows = data.slice(1);

  const labels = rows.map((r) => r[0]);

  return seriesNames.map((name, si) => ({
    name,
    labels,
    values: rows.map((r) => r[si + 1]),
  }));
}

// barDirection 映射：组件入参 'bar'/'column' → pptxgenjs barDir 'bar'/'col'
export function mapBarDir(direction) {
  if (direction === 'bar') return 'bar';
  return 'col'; // 默认 column
}

// grouping 映射：clustered/stacked/percentStacked/standard → pptxgenjs chartLayout? 
// 注意：pptxgenjs 的 bar/area 用 barDir + 默认，grouping 需要查具体支持
export function mapGrouping(grouping) {
  // pptxgenjs 对 stacking 的支持有限，这里先透传，后续按需处理
  return grouping || null;
}

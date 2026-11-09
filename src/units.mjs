// 单位换算：px ↔ inch ↔ EMU
// 约定：
//   DSL/Yoga 层用 px，输出层 inch = px / 96，落盘 EMU = inch × 914400

export const PX_PER_INCH = 96;
export const EMU_PER_INCH = 914400;

export function pxToInch(px) {
  return px / PX_PER_INCH;
}

export function inchToEmu(inch) {
  return Math.round(inch * EMU_PER_INCH);
}

export function pxToEmu(px) {
  return inchToEmu(pxToInch(px));
}

// fontSize 以设计 px 为单位，输出时 ×0.75 转为实际 pt。
// 语义：DSL 里 fontSize 是"设计字号"，实际 PPT 字号 = fontSize × 0.75。
// 换算在「布局测量」和「输出」两处都要生效，否则字号与布局不一致。
export const FONT_SIZE_RATIO = 0.75;

// 把设计字号转成实际字号（pt）
export function toPtFontSize(designFontSize) {
  return designFontSize * FONT_SIZE_RATIO;
}

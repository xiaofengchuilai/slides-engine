// QRCode 组件：文本 → QR Code SVG → PNG 位图
// 复用 svg.mjs 的 svgToPngBase64（SVG→PNG 链路）
import QRCodeLib from 'qrcode';
import { svgToPngBase64 } from './svg.mjs';

// text → QR PNG base64（pptxgenjs addImage data）
export async function getQrPng(text, { width = 240, darkColor = '#000000', lightColor = '#ffffff' } = {}) {
  if (!text) return null;
  try {
    const svg = await QRCodeLib.toString(text, {
      type: 'svg',
      width,
      color: { dark: darkColor, light: lightColor },
      errorCorrectionLevel: 'M',
    });
    return await svgToPngBase64(svg);
  } catch (e) {
    console.warn(`⚠ QRCode 生成失败: ${e.message}`);
    return null;
  }
}

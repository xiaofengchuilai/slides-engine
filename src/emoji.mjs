// Emoji 组件：Twemoji 本地 PNG → data URI（离线渲染彩色 emoji）
// 资源在 src/assets/emoji/{codepoint}.png（72x72，从 jsdelivr twemoji@14.0.2 下载）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'emoji');

// emoji 字符 → Twemoji codepoint 文件名（与 twemoji 的 toCodePoint 一致）
// 注意：twemoji 规则会移除 U+FE0F 变体选择符（如 ❤️ → 2764），保留 ZWJ(200d)
export function emojiCodepoint(emoji) {
  if (!emoji) return null;
  // 去除 U+FE0F（变体选择符）——twemoji 的 codepoint 不包含它
  const clean = [...emoji].filter((ch) => ch.codePointAt(0) !== 0xfe0f);
  // 若为 ZWJ 组合，twemoji 用 200d 连接
  return clean.map((ch) => ch.codePointAt(0).toString(16)).join('-');
}

// emoji → data URI（本地 PNG）
export function getEmojiPng(emoji) {
  const cp = emojiCodepoint(emoji);
  if (!cp) return null;
  const file = path.join(ASSET_DIR, cp + '.png');
  try {
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

// 供 validate 用：检查 emoji 是否有本地资源（不加载图片内容）
export function hasEmoji(emoji) {
  const cp = emojiCodepoint(emoji);
  if (!cp) return false;
  return fs.existsSync(path.join(ASSET_DIR, cp + '.png'));
}

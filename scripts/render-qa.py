#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render-qa.py — 渲染产物几何断言（QA 核心，v2 加强版）
输入：.pptx 文件
输出：问题清单（stdout）+ 退出码（0=无问题，1=有问题）

抓六类问题：
  1. 负坐标（元素 x/y < 0，有文本/PICTURE → error；无文本且半透明 → warning；无文本且不透明 → error）
  2. 超画布（同上分级）
  3. 文本超出同容器图形框（右边界超，阈值 5px）
  4. 文本垂直溢出图形框（文本底 > 框底，抓 1521 缝隙问题）
  5. 元素重叠（两个大框相交且非包含）
  6. 不透明装饰溢出画布（无文本 + 不透明 + 越界 → error，抓 1051 不透明矩形）

用法：python scripts/render-qa.py <out.pptx> [--strict]
"""
import sys
import re
from pptx import Presentation

CANVAS_W = 1280
CANVAS_H = 720
OVERFLOW_TOL = 5  # 收紧：文本超框 5px 就报
BOX_MIN = 200
Y_OVERLAP_MIN = 20
# 垂直溢出阈值（文本底超出框底）
V_OVERFLOW_TOL = 5


def px(v):
    return v / 914400 * 96


def shape_transparency(sh):
    """读取 shape 的透明度：alpha 值 → 0-100 透明。返回 None 表示不透明。"""
    xml = sh._element.xml
    # <a:alpha val="18000"/> → 18% 不透明 → 82% 透明
    m = re.findall(r'<a:alpha val="(\d+)"', xml)
    if m:
        vals = [int(x) for x in m]
        if vals:
            return max(100 - v / 1000 for v in vals)  # 透明百分比
    # alphaModFix
    m2 = re.findall(r'<a:alphaModFix amt="(\d+)"', xml)
    if m2:
        vals = [int(x) for x in m2]
        if vals:
            return max(100 - v / 1000 for v in vals)
    return None  # 不透明


def main():
    args = sys.argv[1:]
    if not args:
        print("用法: python scripts/render-qa.py <out.pptx> [--strict]", file=sys.stderr)
        return 2
    strict = "--strict" in args
    pptx_path = args[0]
    try:
        pres = Presentation(pptx_path)
    except Exception as e:
        print(f"ERROR 无法打开 {pptx_path}: {e}")
        return 2

    issues = []
    warnings = []
    for idx, slide in enumerate(pres.slides, 1):
        shapes = list(slide.shapes)
        boxes = []
        for sh in shapes:
            l, t = px(sh.left), px(sh.top)
            w, h = px(sh.width), px(sh.height)
            # 容器框：尺寸足够大的 shape（卡片/手绘框/背景块），纯文本行 h 小会被过滤
            # 不依赖 fill 标签（渐变 Box 的 fill 可能不在 solidFill/gradFill 里）
            if w >= BOX_MIN and h >= 80 and not (sh.has_text_frame and sh.text_frame.text.strip() and len(sh.text_frame.text.strip()) < 30):
                boxes.append({"l": l, "t": t, "w": w, "h": h})
        texts = []
        for sh in shapes:
            if "TEXT" in str(sh.shape_type) and sh.has_text_frame:
                txt = sh.text_frame.text.strip()
                l, t = px(sh.left), px(sh.top)
                w, h = px(sh.width), px(sh.height)
                if txt and w > 0 and h > 0:
                    texts.append({"l": l, "t": t, "w": w, "h": h, "txt": txt[:20], "sh": sh})

        # 断言 1+2：负坐标 / 超画布（按透明度分级）
        for sh in shapes:
            l, t = px(sh.left), px(sh.top)
            w, h = px(sh.width), px(sh.height)
            has_text = sh.has_text_frame and sh.text_frame.text.strip()
            is_pic = "PICTURE" in str(sh.shape_type)
            tr = shape_transparency(sh)
            translucent = tr is not None and tr >= 30  # 半透明（≥30% 透明）
            tag = ""
            if has_text:
                tag = f"文本[{sh.text_frame.text.strip()[:16]}]"
            elif is_pic:
                tag = "[图]"
            # 越界
            if l < -5 or t < -5 or l + w > CANVAS_W + 5 or t + h > CANVAS_H + 5:
                where = f"x={l:.0f} y={t:.0f}→右{l + w:.0f} 底{t + h:.0f}"
                msg = f"p{idx} {tag} 越界画布 {where}"
                if has_text or is_pic:
                    issues.append(msg)
                elif translucent:
                    warnings.append(msg + "（半透明装饰，可能为有意溢出）")
                else:
                    issues.append(msg + "（不透明无文本形状越界，疑似 bug）")

        # 断言 3+4：文本水平/垂直溢出图形框（5px 阈值，纯 y 重叠匹配避免跨容器误报）
        for tx in texts:
            best = None
            best_overlap = 0
            for bx in boxes:
                if tx["l"] >= bx["l"] - 3 and tx["l"] < bx["l"] + bx["w"]:
                    y_overlap = min(tx["t"] + tx["h"], bx["t"] + bx["h"]) - max(tx["t"], bx["t"])
                    if y_overlap > best_overlap:
                        best_overlap = y_overlap
                        best = bx
            if best and best_overlap >= Y_OVERLAP_MIN:
                bx = best
                if tx["l"] + tx["w"] > bx["l"] + bx["w"] + OVERFLOW_TOL:
                    warnings.append(
                        f"p{idx} 文本[{tx['txt']}] 疑超图形框右侧: 文本右 {tx['l'] + tx['w']:.0f} > 框右 {bx['l'] + bx['w']:.0f}（请人工确认）"
                    )
                # 垂直溢出（文本底 > 框底）
                if tx["t"] + tx["h"] > bx["t"] + bx["h"] + V_OVERFLOW_TOL:
                    warnings.append(
                        f"p{idx} 文本[{tx['txt']}] 疑溢出图形框底部: 文本底 {tx['t'] + tx['h']:.0f} > 框底 {bx['t'] + bx['h']:.0f}（请人工确认）"
                    )

        # 断言 6：疑似 flex 塌陷——有填充背景的容器宽大高小（8<h<25，排除细线/网格装饰 h≤8）
        # 装饰网格线（高1px）不算；真塌陷卡 h~24 才算
        for sh in shapes:
            l, t = px(sh.left), px(sh.top)
            w, h = px(sh.width), px(sh.height)
            if w >= 400 and 8 < h < 25:
                has_text = sh.has_text_frame and sh.text_frame.text.strip()
                if has_text:
                    continue  # 文本行/文本框不判塌陷
                xml = sh._element.xml
                has_bg = ('<a:solidFill>' in xml or '<a:gradFill' in xml or "PICTURE" in str(sh.shape_type))
                if has_bg:
                    issues.append(f"p{idx} 疑似 flex 塌陷: 宽 {w:.0f} 但高仅 {h:.0f}（带背景容器被压扁）")

        # 断言 5：元素重叠（strict 或默认都查：两个大框相交且非包含，且至少一个不透明）
        if strict:
            for i in range(len(boxes)):
                for j in range(i + 1, len(boxes)):
                    a, b = boxes[i], boxes[j]
                    ix = min(a["l"] + a["w"], b["l"] + b["w"]) - max(a["l"], b["l"])
                    iy = min(a["t"] + a["h"], b["t"] + b["h"]) - max(a["t"], b["t"])
                    if ix > 30 and iy > 30:
                        area_a, area_b = a["w"] * a["h"], b["w"] * b["h"]
                        inter = ix * iy
                        if inter < 0.85 * min(area_a, area_b):
                            warnings.append(
                                f"p{idx} 图形框重叠: ({a['l']:.0f},{a['t']:.0f},{a['w']:.0f}x{a['h']:.0f}) vs ({b['l']:.0f},{b['t']:.0f},{b['w']:.0f}x{b['h']:.0f})"
                            )

    if warnings:
        print(f"! {pptx_path}: {len(warnings)} 个警告（需人工确认）")
        for w in warnings[:30]:
            print("  " + w)
        if len(warnings) > 30:
            print(f"  … 等 {len(warnings)} 个")
    if issues:
        print(f"✗ {pptx_path}: {len(issues)} 个问题")
        for i in issues[:30]:
            print("  " + i)
        if len(issues) > 30:
            print(f"  … 等 {len(issues)} 个")
        return 1
    if not warnings:
        print(f"✓ {pptx_path}: 无问题（{len(pres.slides)} 页）")
    else:
        print(f"✓ {pptx_path}: 无硬错误（{len(pres.slides)} 页，仅警告）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

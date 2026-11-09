#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
golden-diff.py — 黄金样本对比（QA 回归核心）
对比两份 pptx 的逐页逐 shape 布局，输出差异。
只判断「变没变」，不判断「对不对」——引擎改动导致任何布局变化都会报出。

用法：
  python scripts/golden-diff.py <baseline.pptx> <current.pptx> [--tolerance 3]
退出码：0=无差异，1=有差异
"""
import sys
from pptx import Presentation


def dump_layout(path):
    """提取 pptx 的布局指纹：每页的 shape 坐标/尺寸/类型/文本"""
    pres = Presentation(path)
    pages = []
    for si, slide in enumerate(pres.slides, 1):
        shapes = []
        for sh in slide.shapes:
            l = sh.left / 914400 * 96
            t = sh.top / 914400 * 96
            w = sh.width / 914400 * 96
            h = sh.height / 914400 * 96
            kind = str(sh.shape_type).split('.')[-1] if '.' in str(sh.shape_type) else str(sh.shape_type)
            txt = sh.text_frame.text[:40].replace('\n', '⏎') if sh.has_text_frame else ''
            shapes.append((round(l, 1), round(t, 1), round(w, 1), round(h, 1), kind, txt))
        # 按 (top, left) 排序保证顺序稳定
        shapes.sort(key=lambda s: (s[1], s[0]))
        pages.append(shapes)
    return pages


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print("用法: python scripts/golden-diff.py <baseline.pptx> <current.pptx> [--tolerance N]", file=sys.stderr)
        return 2
    tol = 3
    if "--tolerance" in args:
        i = args.index("--tolerance")
        tol = float(args[i + 1])
        args = args[:i] + args[i + 2:]
    base, curr = args[0], args[1]

    try:
        pb = dump_layout(base)
        pc = dump_layout(curr)
    except Exception as e:
        print(f"ERROR: {e}")
        return 2

    if len(pb) != len(pc):
        print(f"✗ 页数不同: baseline {len(pb)} vs current {len(pc)}")
        return 1

    diffs = []
    for si, (b, c) in enumerate(zip(pb, pc), 1):
        if len(b) != len(c):
            diffs.append(f"p{si}: shape 数量 {len(b)} → {len(c)}")
        # 逐 shape 对比（同索引，按坐标排序后）
        for i in range(min(len(b), len(c))):
            bb, cc = b[i], c[i]
            if abs(bb[0] - cc[0]) > tol or abs(bb[1] - cc[1]) > tol or abs(bb[2] - cc[2]) > tol or abs(bb[3] - cc[3]) > tol:
                diffs.append(
                    f"p{si} shape#{i}: 坐标 ({bb[0]},{bb[1]},{bb[2]}x{bb[3]}) → ({cc[0]},{cc[1]},{cc[2]}x{cc[3]}) [{bb[4]}] {bb[5][:12]}"
                )
            elif bb[4] != cc[4] or bb[5] != cc[5]:
                diffs.append(f"p{si} shape#{i}: 类型/文本变化 [{bb[4]}]→[{cc[4]}] {bb[5][:10]}→{cc[5][:10]}")

    if diffs:
        print(f"✗ {len(diffs)} 处布局差异（tolerance {tol}px）:")
        for d in diffs[:40]:
            print("  " + d)
        if len(diffs) > 40:
            print(f"  … 等 {len(diffs)} 处")
        return 1
    print(f"✓ {curr}: 与 baseline 布局一致（{len(pb)} 页）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
